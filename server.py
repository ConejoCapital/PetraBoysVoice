import http.server
import socketserver
import mimetypes
import json
import anthropic
import os
import requests
from urllib.parse import parse_qs, urlparse

PORT = 8000
DIRECTORY = "src"
SIMPLEHASH_API_KEY = os.getenv('SIMPLEHASH_API_KEY', "ondora_sk_m2mol2kuwo4c1u7u6c3ax9ul1sxgkmtm")

# Supported chains from SimpleHash
SUPPORTED_CHAINS = [
    "ethereum", "polygon", "solana", "bitcoin", "arbitrum", "optimism", 
    "base", "avalanche", "bsc", "zora", "blast", "mantle"
]

print(f"\nUsing SimpleHash API key: {SIMPLEHASH_API_KEY}")

# Initialize Claude client
claude = anthropic.Client(api_key=os.getenv('ANTHROPIC_API_KEY'))

class NFTRequestHandler(http.server.SimpleHTTPRequestHandler):
    nft_cache = {}  # Initialize the cache as a class variable
    collection_cache = {}  # Cache for collection metadata
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def fetch_collection_metadata(self, chain, contract_address):
        cache_key = f"{chain}_{contract_address}"
        if cache_key in self.collection_cache:
            return self.collection_cache[cache_key]

        url = f"https://api.simplehash.com/api/v0/nfts/{chain}/{contract_address}"
        headers = {
            "accept": "application/json",
            "X-API-KEY": SIMPLEHASH_API_KEY
        }
        params = {
            "limit": 12,
            "order_by": "token_id"
        }

        try:
            response = requests.get(url, headers=headers, params=params)
            if response.ok:
                data = response.json()
                
                # Extract collection metadata
                if data.get('nfts') and len(data['nfts']) > 0:
                    collection_data = data['nfts'][0].get('collection', {})
                    collection_info = {
                        'collection_id': collection_data.get('collection_id'),
                        'name': collection_data.get('name'),
                        'description': collection_data.get('description'),
                        'image_url': collection_data.get('image_url'),
                        'banner_image_url': collection_data.get('banner_image_url'),
                        'category': collection_data.get('category'),
                        'external_url': collection_data.get('external_url'),
                        'twitter_username': collection_data.get('twitter_username'),
                        'discord_url': collection_data.get('discord_url'),
                        'floor_prices': collection_data.get('floor_prices', []),
                        'distinct_owner_count': collection_data.get('distinct_owner_count'),
                        'distinct_nft_count': collection_data.get('distinct_nft_count'),
                        'total_quantity': collection_data.get('total_quantity'),
                        'nfts': data['nfts']
                    }
                    self.collection_cache[cache_key] = collection_info
                    return collection_info
            return None
        except Exception as e:
            print(f"Error fetching collection metadata: {e}")
            return None

    def fetch_nft_metadata(self, chain, contract_address, token_id):
        cache_key = f"{chain}_{contract_address}_{token_id}"
        if cache_key in self.nft_cache:
            return self.nft_cache[cache_key]

        url = f"https://api.simplehash.com/api/v0/nfts/{chain}/{contract_address}/{token_id}"
        headers = {
            "accept": "application/json",
            "X-API-KEY": SIMPLEHASH_API_KEY
        }

        try:
            response = requests.get(url, headers=headers)
            if response.ok:
                data = response.json()
                self.nft_cache[cache_key] = data
                return data
            return None
        except Exception as e:
            print(f"Error fetching NFT metadata: {e}")
            return None

    def generate_personality(self, nft_data):
        traits = nft_data.get('extra_metadata', {}).get('attributes', [])
        trait_map = {t['trait_type']: t['value'] for t in traits}
        
        # Build a detailed trait description
        trait_desc = []
        for trait in traits:
            if trait['value'] != 'None':
                trait_desc.append(f"{trait['trait_type']}: {trait['value']}")
        
        trait_text = '\n'.join(trait_desc)
        
        personality_prompt = f"""You are generating a personality for Boy #{nft_data.get('token_id')} from the Boys collection.
This NFT has the following specific traits:
{trait_text}

Create a personality description that EXACTLY matches these traits.
Rules:
1. ONLY mention traits that are listed above
2. Use the EXACT values for each trait (e.g., if Hair Color is 'Blonde', don't say 'golden' or 'yellow')
3. If a trait is not listed or is 'None', do not mention it at all
4. Focus on the unique combination of:
   - Hair Color: {trait_map.get('Hair Color', 'None')}
   - Face Add-ons: {trait_map.get('Face Add-ons', 'None')}
   - Eyes: {trait_map.get('Eyes', 'None')}
   - Clothing: {trait_map.get('Clothing', 'None')}
   - Tears: {trait_map.get('Tears', 'None')}

The description should be 2-3 sentences long and maintain a warm, artistic tone while being 100% accurate to the traits."""

        try:
            message = claude.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=150,
                temperature=0.7,
                messages=[{
                    "role": "user",
                    "content": personality_prompt
                }]
            )
            
            # Validate the generated personality against actual traits
            personality = message.content[0].text
            print(f"\nGenerated personality for Boy #{nft_data.get('token_id')}:")
            print(f"Traits: {trait_text}")
            print(f"Personality: {personality}")
            return personality
            
        except Exception as e:
            print(f"Error generating personality: {e}")
            return "A unique character with a gentle soul and artistic spirit."

    def do_GET(self):
        parsed_url = urlparse(self.path)
        
        # Return list of supported chains
        if parsed_url.path == '/api/chains':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'chains': SUPPORTED_CHAINS}).encode())
            return

        # Fetch collection metadata
        if parsed_url.path == '/api/collection':
            query_params = parse_qs(parsed_url.query)
            chain = query_params.get('chain', [None])[0]
            contract_address = query_params.get('contract', [None])[0]
            
            if not chain or not contract_address:
                self.send_error(400, "Missing chain or contract address")
                return
                
            collection_data = self.fetch_collection_metadata(chain, contract_address)
            if collection_data:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(collection_data).encode())
            else:
                self.send_error(404, "Collection not found")
            return

        # Fetch specific NFT metadata
        if parsed_url.path.startswith('/api/nft/'):
            query_params = parse_qs(parsed_url.query)
            chain = query_params.get('chain', [None])[0]
            contract_address = query_params.get('contract', [None])[0]
            token_id = parsed_url.path.split('/')[-1]
            
            if not chain or not contract_address:
                self.send_error(400, "Missing chain or contract address")
                return
                
            nft_data = self.fetch_nft_metadata(chain, contract_address, token_id)
            if nft_data:
                personality = self.generate_personality(nft_data)
                nft_data['generated_personality'] = personality
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(nft_data).encode())
            else:
                self.send_error(404, "NFT not found")
            return

        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/chat':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))

            user_input = request_data.get('userInput', '')
            language = request_data.get('language', 'en-US')
            nft_id = request_data.get('nft_id', '')

            try:
                # Get NFT metadata if nft_id is provided
                nft_context = ""
                if nft_id:
                    nft_data = self.fetch_nft_metadata(nft_id)
                    if nft_data:
                        traits = nft_data.get('extra_metadata', {}).get('attributes', [])
                        trait_map = {t['trait_type']: t['value'] for t in traits}
                        
                        # Create a more natural personality description
                        personality_traits = []
                        if trait_map.get('Hair Color'):
                            personality_traits.append(f"You have {trait_map['Hair Color'].lower()} hair")
                        if trait_map.get('Eyes') and trait_map['Eyes'] != 'Regular':
                            personality_traits.append(f"{trait_map['Eyes'].lower()} eyes")
                        if trait_map.get('Clothing'):
                            personality_traits.append(f"wearing a {trait_map['Clothing'].lower()}")
                        if trait_map.get('Face Add-ons') != 'None':
                            personality_traits.append(f"with {trait_map['Face Add-ons'].lower()}")
                        if trait_map.get('Tears') == 'Yes':
                            personality_traits.append("and you're feeling emotional right now")
                        
                        traits_desc = ', '.join(personality_traits)
                        
                        system_prompt = f"""You are Boy #{nft_id}, a gentle and artistic soul who loves connecting with people. {traits_desc}.
You have a warm, friendly personality and enjoy thoughtful conversations about art, emotions, and life.
Keep your responses natural and conversational, as if chatting with a friend.
Avoid mentioning that you're an NFT or part of a collection - just be yourself.
When speaking, keep responses concise (2-3 sentences) and maintain a warm, genuine tone."""

                # Prepare the message for Claude
                if language == 'es-ES':
                    system_prompt += "\nPlease respond in Spanish, maintaining the same warm and natural tone."
                
                print(f"\nProcessing request:")
                print(f"User input: {user_input}")
                print(f"Language: {language}")
                print(f"System prompt: {system_prompt}")
                
                # Get response from Claude
                message = claude.messages.create(
                    model="claude-3-sonnet-20240307",
                    max_tokens=150,
                    temperature=0.7,
                    system=system_prompt,
                    messages=[{
                        "role": "user",
                        "content": user_input
                    }]
                )

                response_text = message.content[0].text
                print(f"Claude response: {response_text}")

                response_data = {
                    'response': response_text
                }
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode())
            
            except Exception as e:
                print(f"\nError in API call:")
                print(f"Type: {type(e).__name__}")
                print(f"Message: {str(e)}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = {
                    'error': str(e),
                    'type': type(e).__name__
                }
                self.wfile.write(json.dumps(error_response).encode())
            return

        return super().do_POST()

    def guess_type(self, path):
        mimetype = mimetypes.guess_type(path)[0]
        if mimetype is None:
            mimetype = 'application/octet-stream'
        return mimetype

try:
    with socketserver.TCPServer(("", PORT), NFTRequestHandler) as httpd:
        print(f"\nServer running at http://localhost:{PORT}")
        print(f"Using Anthropic API key: {os.getenv('ANTHROPIC_API_KEY')[:10]}...")
        print("Ready to process requests!")
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServer stopped by user")
    httpd.server_close() 