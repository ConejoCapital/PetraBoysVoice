from http.server import BaseHTTPRequestHandler
import json
import os
import anthropic
import requests
from urllib.parse import parse_qs, urlparse

SIMPLEHASH_API_KEY = os.getenv('SIMPLEHASH_API_KEY')
SUPPORTED_CHAINS = [
    "ethereum", "polygon", "solana", "bitcoin", "arbitrum", "optimism", 
    "base", "avalanche", "bsc", "zora", "blast", "mantle"
]

# Initialize Claude client
claude = anthropic.Client(api_key=os.getenv('ANTHROPIC_API_KEY'))

def fetch_collection_metadata(chain, contract_address):
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
            
            if data.get('nfts') and len(data['nfts']) > 0:
                collection_data = data['nfts'][0].get('collection', {})
                return {
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
        return None
    except Exception as e:
        print(f"Error fetching collection metadata: {e}")
        return None

def fetch_nft_metadata(chain, contract_address, token_id):
    url = f"https://api.simplehash.com/api/v0/nfts/{chain}/{contract_address}/{token_id}"
    headers = {
        "accept": "application/json",
        "X-API-KEY": SIMPLEHASH_API_KEY
    }

    try:
        response = requests.get(url, headers=headers)
        if response.ok:
            return response.json()
        return None
    except Exception as e:
        print(f"Error fetching NFT metadata: {e}")
        return None

def generate_personality(nft_data):
    traits = nft_data.get('extra_metadata', {}).get('attributes', [])
    trait_map = {t['trait_type']: t['value'] for t in traits}
    
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
            model="claude-3-sonnet-20240307",
            max_tokens=150,
            temperature=0.7,
            messages=[{
                "role": "user",
                "content": personality_prompt
            }]
        )
        return message.content[0].text
    except Exception as e:
        print(f"Error generating personality: {e}")
        return "A unique character with a gentle soul and artistic spirit."

def handle_request(request):
    if request.get('path', '').startswith('/api/'):
        path = request.get('path', '')
        method = request.get('method', 'GET')
        query = parse_qs(urlparse(path).query)
        
        # Handle /api/chains
        if path == '/api/chains':
            return {
                'statusCode': 200,
                'body': json.dumps({'chains': SUPPORTED_CHAINS})
            }
            
        # Handle /api/collection
        if path == '/api/collection':
            chain = query.get('chain', [None])[0]
            contract_address = query.get('contract', [None])[0]
            
            if not chain or not contract_address:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'Missing chain or contract address'})
                }
                
            collection_data = fetch_collection_metadata(chain, contract_address)
            if collection_data:
                return {
                    'statusCode': 200,
                    'body': json.dumps(collection_data)
                }
            else:
                return {
                    'statusCode': 404,
                    'body': json.dumps({'error': 'Collection not found'})
                }
                
        # Handle /api/nft/{token_id}
        if path.startswith('/api/nft/'):
            token_id = path.split('/')[-1]
            chain = query.get('chain', [None])[0]
            contract_address = query.get('contract', [None])[0]
            
            if not chain or not contract_address:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'Missing chain or contract address'})
                }
                
            nft_data = fetch_nft_metadata(chain, contract_address, token_id)
            if nft_data:
                personality = generate_personality(nft_data)
                nft_data['generated_personality'] = personality
                return {
                    'statusCode': 200,
                    'body': json.dumps(nft_data)
                }
            else:
                return {
                    'statusCode': 404,
                    'body': json.dumps({'error': 'NFT not found'})
                }
                
        # Handle /api/chat
        if path == '/api/chat' and method == 'POST':
            try:
                body = json.loads(request.get('body', '{}'))
                user_input = body.get('userInput', '')
                language = body.get('language', 'en-US')
                nft_id = body.get('nft_id', '')
                
                if not user_input:
                    return {
                        'statusCode': 400,
                        'body': json.dumps({'error': 'Missing user input'})
                    }
                    
                # Get NFT metadata if nft_id is provided
                nft_context = ""
                if nft_id:
                    nft_data = fetch_nft_metadata(nft_id)
                    if nft_data:
                        traits = nft_data.get('extra_metadata', {}).get('attributes', [])
                        trait_map = {t['trait_type']: t['value'] for t in traits}
                        
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
                
                return {
                    'statusCode': 200,
                    'body': json.dumps({'response': response_text})
                }
                
            except Exception as e:
                return {
                    'statusCode': 500,
                    'body': json.dumps({
                        'error': str(e),
                        'type': type(e).__name__
                    })
                }
    
    return {
        'statusCode': 404,
        'body': json.dumps({'error': 'Not found'})
    }

def handler(request, context):
    response = handle_request(request)
    
    return {
        'statusCode': response.get('statusCode', 500),
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        },
        'body': response.get('body', '{"error": "Internal server error"}')
    } 