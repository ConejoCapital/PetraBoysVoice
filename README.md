# NFT Voice Chat

A voice-enabled chat interface for interacting with NFTs across multiple blockchains. This application uses the SimpleHash API to fetch NFT metadata and Claude AI to generate contextually aware responses.

## Features

- Support for multiple blockchain networks (Ethereum, Polygon, Solana, etc.)
- Dynamic NFT collection loading with metadata display
- Voice interaction in multiple languages (English and Spanish)
- Real-time speech-to-text and text-to-speech
- Collection statistics and social links
- Preloading of NFT images for smooth experience
- Responsive design for mobile and desktop

## Prerequisites

- Python 3.8 or higher
- Node.js 18 or higher
- SimpleHash API key
- Anthropic (Claude) API key

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
SIMPLEHASH_API_KEY=your_simplehash_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/nft-voice-chat.git
cd nft-voice-chat
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Install Node.js dependencies:
```bash
npm install
```

## Development

Start the development server:
```bash
python server.py
```

The application will be available at `http://localhost:8000`.

## Deployment on Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy to Vercel:
```bash
vercel
```

3. Set up environment variables in Vercel:
- Go to your project settings
- Add the environment variables:
  - `SIMPLEHASH_API_KEY`
  - `ANTHROPIC_API_KEY`

## Usage

1. Select a blockchain network from the dropdown menu
2. Enter an NFT contract address
3. Click "Load Collection" to fetch the collection metadata
4. Select an NFT from the collection to interact with
5. Use the microphone button to start voice interaction
6. Toggle between English and Spanish using the language button

## API Endpoints

- `GET /api/chains` - Get list of supported blockchain networks
- `GET /api/collection?chain={chain}&contract={address}` - Get collection metadata
- `GET /api/nft/{tokenId}?chain={chain}&contract={address}` - Get specific NFT metadata
- `POST /api/chat` - Send user message and get AI response

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [SimpleHash](https://simplehash.com/) for NFT data
- [Anthropic](https://www.anthropic.com/) for Claude AI
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) for voice interaction 