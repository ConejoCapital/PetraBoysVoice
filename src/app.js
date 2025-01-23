class NFTVoiceChat {
    constructor() {
        this.currentLanguage = 'en-US';
        this.isRecording = false;
        this.currentNFT = null;
        this.selectedChain = '';
        this.selectedContract = '';
        
        // Initialize UI elements
        this.chainSelect = document.getElementById('chainSelect');
        this.contractInput = document.getElementById('contractInput');
        this.loadButton = document.getElementById('loadCollection');
        this.nftSelect = document.getElementById('nftSelect');
        this.nftImage = document.getElementById('nftImage');
        this.nftTraits = document.getElementById('nftTraits');
        this.toggleLanguageBtn = document.getElementById('toggleLanguage');
        this.recordButton = document.getElementById('recordButton');
        this.chatBox = document.getElementById('chatBox');
        
        // Collection metadata elements
        this.collectionBanner = document.getElementById('collectionBanner');
        this.collectionLogo = document.getElementById('collectionLogo');
        this.collectionName = document.getElementById('collectionName');
        this.collectionDescription = document.getElementById('collectionDescription');
        this.floorPrice = document.getElementById('floorPrice');
        this.totalItems = document.getElementById('totalItems');
        this.ownerCount = document.getElementById('ownerCount');
        this.twitterLink = document.getElementById('twitterLink');
        this.discordLink = document.getElementById('discordLink');
        this.websiteLink = document.getElementById('websiteLink');
        
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        
        this.setupEventListeners();
        this.loadChains();
        
        // Automatically load the Petra Boys collection
        this.loadCollection();
    }

    async loadChains() {
        try {
            const response = await fetch('/api/chains');
            const data = await response.json();
            
            this.chainSelect.innerHTML = '<option value="">Select Chain</option>';
            data.chains.forEach(chain => {
                const option = document.createElement('option');
                option.value = chain;
                option.textContent = chain.charAt(0).toUpperCase() + chain.slice(1);
                this.chainSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading chains:', error);
        }
    }

    async loadCollection() {
        try {
            const chain = this.chainSelect.value;
            const contract = this.contractInput.value;
            
            const response = await fetch(`/api/collection?chain=${chain}&contract=${contract}`);
            if (!response.ok) throw new Error('Failed to load collection');
            
            const data = await response.json();
            this.updateCollectionUI(data);
            
            // Populate NFT select with the first 12 NFTs
            this.nftSelect.innerHTML = '<option value="">Select an NFT</option>';
            data.nfts.forEach(nft => {
                const option = document.createElement('option');
                option.value = nft.token_id;
                option.textContent = `Boy #${nft.token_id}`;
                this.nftSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading collection:', error);
        }
    }

    updateCollectionMetadata(data) {
        // Update collection banner
        if (data.banner_image_url) {
            this.collectionBanner.src = data.banner_image_url;
            this.collectionBanner.style.display = 'block';
        } else {
            this.collectionBanner.style.display = 'none';
        }
        
        // Update collection logo
        if (data.image_url) {
            this.collectionLogo.src = data.image_url;
            this.collectionLogo.style.display = 'block';
        } else {
            this.collectionLogo.style.display = 'none';
        }
        
        // Update collection details
        this.collectionName.textContent = data.name || 'Unnamed Collection';
        this.collectionDescription.textContent = data.description || 'No description available';
        
        // Update collection stats
        if (data.floor_prices && data.floor_prices.length > 0) {
            const floorPrice = data.floor_prices[0];
            this.floorPrice.textContent = `${floorPrice.value} ${floorPrice.payment_token.symbol}`;
        } else {
            this.floorPrice.textContent = 'N/A';
        }
        
        this.totalItems.textContent = data.distinct_nft_count || 'N/A';
        this.ownerCount.textContent = data.distinct_owner_count || 'N/A';
        
        // Update social links
        if (data.twitter_username) {
            this.twitterLink.href = `https://twitter.com/${data.twitter_username}`;
            this.twitterLink.style.display = 'flex';
        } else {
            this.twitterLink.style.display = 'none';
        }
        
        if (data.discord_url) {
            this.discordLink.href = data.discord_url;
            this.discordLink.style.display = 'flex';
        } else {
            this.discordLink.style.display = 'none';
        }
        
        if (data.external_url) {
            this.websiteLink.href = data.external_url;
            this.websiteLink.style.display = 'flex';
        } else {
            this.websiteLink.style.display = 'none';
        }
    }

    updateNFTSelector(nfts) {
        this.nftSelect.innerHTML = '<option value="">Select an NFT</option>';
        nfts.slice(0, 12).forEach(nft => {
            const option = document.createElement('option');
            option.value = nft.token_id;
            option.textContent = nft.name || `NFT #${nft.token_id}`;
            this.nftSelect.appendChild(option);
        });
    }

    preloadNFTImages(nfts) {
        nfts.slice(0, 12).forEach(nft => {
            if (nft.image_url) {
                const img = new Image();
                img.src = nft.image_url;
            }
        });
    }

    async loadNFTMetadata(tokenId) {
        try {
            const response = await fetch(`/api/nft/${tokenId}?chain=${this.selectedChain}&contract=${this.selectedContract}`);
            const data = await response.json();
            
            // Update NFT display
            if (data.image_url) {
                this.nftImage.src = data.image_url;
                this.nftImage.alt = data.name || `NFT #${tokenId}`;
            }
            
            // Update traits display
            this.nftTraits.innerHTML = '';
            if (data.attributes) {
                data.attributes.forEach(trait => {
                    if (trait.value && trait.value !== 'None') {
                        const traitElement = document.createElement('div');
                        traitElement.className = 'trait-item';
                        traitElement.innerHTML = `
                            <div class="trait-label">${trait.trait_type}</div>
                            <div class="trait-value">${trait.value}</div>
                        `;
                        this.nftTraits.appendChild(traitElement);
                    }
                });
            }
            
            this.currentNFT = data;
        } catch (error) {
            console.error('Error loading NFT metadata:', error);
            alert('Error loading NFT metadata. Please try again.');
        }
    }

    setupEventListeners() {
        // Chain and contract selection
        this.chainSelect.addEventListener('change', (e) => {
            this.selectedChain = e.target.value;
        });
        
        this.contractInput.addEventListener('input', (e) => {
            this.selectedContract = e.target.value;
        });
        
        this.loadButton.addEventListener('click', () => {
            this.loadCollection();
        });
        
        // NFT selection
        this.nftSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadNFTMetadata(e.target.value);
            }
        });
        
        // Language toggle
        this.toggleLanguageBtn.addEventListener('click', () => {
            this.currentLanguage = this.currentLanguage === 'en-US' ? 'es-ES' : 'en-US';
            this.toggleLanguageBtn.textContent = `🌐 ${this.currentLanguage === 'en-US' ? 'EN' : 'ES'}`;
        });
        
        // Speech recognition setup
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.handleUserInput(transcript);
            };
            
            this.recognition.onend = () => {
                this.isRecording = false;
                this.updateRecordButtonState();
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isRecording = false;
                this.updateRecordButtonState();
            };
        }
        
        // Record button
        this.recordButton.addEventListener('click', () => {
            if (!this.currentNFT) {
                alert('Please select an NFT first');
                return;
            }
            
            if (!this.isRecording) {
                this.startRecording();
            } else {
                this.stopRecording();
            }
        });
    }

    startRecording() {
        if (this.recognition) {
            this.recognition.lang = this.currentLanguage;
            this.recognition.start();
            this.isRecording = true;
            this.updateRecordButtonState();
        }
    }

    stopRecording() {
        if (this.recognition) {
            this.recognition.stop();
            this.isRecording = false;
            this.updateRecordButtonState();
        }
    }

    updateRecordButtonState() {
        const statusText = this.recordButton.querySelector('.status-text');
        const recordIcon = this.recordButton.querySelector('.record-icon');
        
        if (this.isRecording) {
            statusText.textContent = 'Listening...';
            recordIcon.textContent = '⏹️';
            this.recordButton.classList.add('recording');
        } else {
            statusText.textContent = 'Click to speak';
            recordIcon.textContent = '🎤';
            this.recordButton.classList.remove('recording');
        }
    }

    async handleUserInput(text) {
        if (!text.trim()) return;
        
        this.addMessageToChat('user', text);
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userInput: text,
                    language: this.currentLanguage,
                    nft_id: this.currentNFT.token_id
                })
            });
            
            const data = await response.json();
            if (data.response) {
                this.addMessageToChat('nft', data.response);
                this.speakResponse(data.response);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessageToChat('system', 'Error processing your message. Please try again.');
        }
    }

    addMessageToChat(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        messageDiv.textContent = text;
        this.chatBox.appendChild(messageDiv);
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }

    speakResponse(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = this.currentLanguage;
            utterance.rate = 1.1;
            utterance.pitch = this.currentLanguage === 'en-US' ? 1.1 : 1.2;
            window.speechSynthesis.speak(utterance);
        }
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new NFTVoiceChat();
}); 