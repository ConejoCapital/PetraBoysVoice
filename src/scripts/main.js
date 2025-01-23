class NFTVoiceChat {
    constructor() {
        this.talkButton = document.getElementById('talkButton');
        this.languageButton = document.getElementById('languageButton');
        this.statusText = document.getElementById('statusText');
        this.nftSelect = document.getElementById('nftSelect');
        this.nftImage = document.getElementById('nftImage');
        this.nftTraits = document.getElementById('nftTraits');
        this.isRecording = false;
        this.currentLanguage = 'en-US';
        this.currentNFT = null;
        
        // Initialize Web Speech API
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = this.currentLanguage;
        
        // Initialize speech synthesis
        this.synthesis = window.speechSynthesis;
        this.voices = [];
        
        // Load voices when they're ready
        window.speechSynthesis.onvoiceschanged = () => {
            this.voices = window.speechSynthesis.getVoices();
        };
        
        this.setupEventListeners();
        this.loadNFTs();
        
        // Base context for NFT personality
        this.baseContext = `You are an NFT from the Boys collection by artist Petra Voice. 
You are a dreamy, soft portrait that embodies gentle masculinity. 
Your personality is gentle, artistic, and emotionally aware. You love discussing art, emotions, and connecting with people.
You are part of a collection that celebrates diversity and different moods.
When speaking, keep responses concise (2-3 sentences) and maintain a warm, friendly tone.
Always stay in character as this NFT artwork.`;
    }

    async loadNFTs() {
        try {
            const response = await fetch('/api/nfts');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch NFTs: ${errorText}`);
            }
            
            const data = await response.json();
            if (!data.nfts || !Array.isArray(data.nfts)) {
                throw new Error('Invalid NFT data format received');
            }
            
            // Clear existing options
            this.nftSelect.innerHTML = '<option value="" disabled selected>Select a Boy to talk to...</option>';
            
            // Add NFT options and preload images
            const imagePromises = data.nfts.map(nft => {
                // Add option to select
                const option = document.createElement('option');
                option.value = nft.token_id;
                option.textContent = `Boy #${nft.token_id}`;
                this.nftSelect.appendChild(option);
                
                // Preload image
                if (nft.image_url) {
                    return new Promise((resolve, reject) => {
                        const img = new Image();
                        img.onload = () => resolve(img);
                        img.onerror = () => reject(new Error(`Failed to load image for Boy #${nft.token_id}`));
                        img.src = nft.image_url;
                    }).catch(error => {
                        console.warn(error);
                        return null;  // Don't fail the whole process if one image fails
                    });
                }
                return null;
            });
            
            // Wait for all images to load
            await Promise.all(imagePromises.filter(p => p !== null));
            this.statusText.textContent = 'All NFT images preloaded and ready!';
            
        } catch (error) {
            console.error('Error loading NFTs:', error);
            this.statusText.textContent = `Error loading NFTs: ${error.message}`;
        }
    }

    async loadNFTMetadata(tokenId) {
        try {
            const response = await fetch(`/api/nft/${tokenId}`);
            if (!response.ok) throw new Error('Failed to fetch NFT metadata');
            
            const nftData = await response.json();
            this.currentNFT = nftData;
            
            // Update image
            if (nftData.image_url) {
                this.nftImage.src = nftData.image_url;
            }
            
            // Update traits display
            this.nftTraits.innerHTML = '';
            if (nftData.attributes) {
                const traitsHtml = nftData.attributes.map(trait => `
                    <div class="trait-item">
                        <span class="trait-label">${trait.trait_type}:</span> ${trait.value}
                    </div>
                `).join('');
                this.nftTraits.innerHTML = traitsHtml;
                this.nftTraits.classList.add('visible');
            }
            
            // Update status
            this.statusText.textContent = `Ready to chat with Boy #${tokenId}!`;
        } catch (error) {
            console.error('Error loading NFT metadata:', error);
            this.statusText.textContent = 'Error loading NFT data. Please try again.';
        }
    }

    setupEventListeners() {
        this.talkButton.addEventListener('click', () => this.toggleRecording());
        this.languageButton.addEventListener('click', () => this.toggleLanguage());
        this.nftSelect.addEventListener('change', (e) => this.loadNFTMetadata(e.target.value));
        
        this.recognition.onstart = () => {
            this.isRecording = true;
            this.updateUI();
        };
        
        this.recognition.onend = () => {
            this.isRecording = false;
            this.updateUI();
        };
        
        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.processUserInput(transcript);
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.statusText.textContent = 'Error: ' + event.error;
            this.isRecording = false;
            this.updateUI();
        };
    }

    toggleLanguage() {
        this.currentLanguage = this.currentLanguage === 'en-US' ? 'es-ES' : 'en-US';
        this.recognition.lang = this.currentLanguage;
        this.languageButton.querySelector('.lang-text').textContent = 
            this.currentLanguage === 'en-US' ? 'EN' : 'ES';
        this.updateUI();
    }

    toggleRecording() {
        if (!this.currentNFT) {
            this.statusText.textContent = 'Please select a Boy to talk to first!';
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
        } else {
            this.recognition.lang = this.currentLanguage;
            this.recognition.start();
            this.statusText.textContent = this.currentLanguage === 'es-ES' ? 'Escuchando...' : 'Listening...';
        }
    }

    updateUI() {
        const buttonText = this.currentLanguage === 'es-ES' ? 
            (this.isRecording ? 'Detener' : 'Presiona para Hablar') :
            (this.isRecording ? 'Stop' : 'Press to Talk');
        
        this.talkButton.textContent = buttonText;
        this.talkButton.classList.toggle('recording', this.isRecording);
        
        if (!this.isRecording) {
            this.statusText.textContent = this.currentLanguage === 'es-ES' ? 
                'Listo para escuchar...' : 
                'Ready to listen...';
        }
    }

    async processUserInput(transcript) {
        this.statusText.textContent = this.currentLanguage === 'es-ES' ? 
            'Has dicho: ' + transcript :
            'You said: ' + transcript;
        
        const response = await this.generateClaudeResponse(transcript);
        this.speak(response.response);
    }

    async generateClaudeResponse(userInput) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userInput,
                    language: this.currentLanguage,
                    context: this.baseContext,
                    nft_id: this.currentNFT ? this.currentNFT.token_id : null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get response from Claude');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error getting Claude response:', error);
            return {
                response: this.currentLanguage === 'es-ES' ? 
                    'Lo siento, tuve un problema al procesar tu mensaje. ¿Podrías intentarlo de nuevo?' :
                    'Sorry, I had trouble processing your message. Could you try again?'
            };
        }
    }

    getBestVoice() {
        const voices = this.voices.filter(voice => voice.lang.startsWith(this.currentLanguage));
        
        // Preferred voice names for each language
        const preferredVoices = {
            'en-US': ['Google US English', 'Samantha', 'Alex'],
            'es-ES': ['Google español', 'Monica', 'Juan']
        };
        
        // Try to find a preferred voice
        for (const preferredName of preferredVoices[this.currentLanguage]) {
            const voice = voices.find(v => v.name.includes(preferredName));
            if (voice) return voice;
        }
        
        // Fallback to any voice in the correct language
        return voices[0] || null;
    }

    speak(text) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        // Split long text into smaller chunks to prevent halting
        const chunks = this.splitTextIntoChunks(text);
        let currentChunk = 0;
        
        const speakNextChunk = () => {
            if (currentChunk < chunks.length) {
                const utterance = new SpeechSynthesisUtterance(chunks[currentChunk]);
                utterance.lang = this.currentLanguage;
                
                // Get the best available voice
                const voice = this.getBestVoice();
                if (voice) {
                    utterance.voice = voice;
                }
                
                // Optimize voice parameters for faster, natural sound
                utterance.rate = 1.1;  // Increased from 0.9 to 1.1 for faster speech
                utterance.pitch = this.currentLanguage === 'es-ES' ? 1.2 : 1.1;
                utterance.volume = 1.0;
                
                // Update status for first chunk only
                if (currentChunk === 0) {
                    this.statusText.textContent = this.currentLanguage === 'es-ES' ? 
                        'NFT está hablando...' :
                        'NFT is speaking...';
                }
                
                utterance.onend = () => {
                    currentChunk++;
                    if (currentChunk < chunks.length) {
                        speakNextChunk();
                    } else {
                        this.statusText.textContent = this.currentLanguage === 'es-ES' ? 
                            'Listo para escuchar...' :
                            'Ready to listen...';
                    }
                };
                
                utterance.onerror = (event) => {
                    console.error('Speech synthesis error:', event);
                    currentChunk++;
                    if (currentChunk < chunks.length) {
                        speakNextChunk();
                    }
                };
                
                window.speechSynthesis.speak(utterance);
            }
        };
        
        speakNextChunk();
    }
    
    splitTextIntoChunks(text, maxLength = 100) {
        // Split text into sentences
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const chunks = [];
        let currentChunk = '';
        
        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxLength) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = sentence;
            } else {
                currentChunk += sentence;
            }
        }
        
        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks;
    }
}

// Initialize the application when the page loads
window.addEventListener('DOMContentLoaded', () => {
    const nftVoiceChat = new NFTVoiceChat();
}); 