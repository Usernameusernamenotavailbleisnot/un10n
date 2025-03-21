# Un10n 

A comprehensive automation tool for un10n, Babylon, Stride, and Stargaze blockchain networks. This bot automates daily interactions, transfers, cross-chain operations, and faucet requests to help users complete tasks in the un10n blockchain ecosystem.

## Features

- **Daily Interactions**: Automate daily interactions with un10n and Babylon chains
- **Transfer Quests**: Execute token transfers between supported chains with configurable amounts
- **Cross-Chain Quests**: Complete predefined cross-chain transfer paths
- **Faucet Integration**: Request tokens from un10n and Stargaze faucets with CAPTCHA solving
- **Multi-Threading Support**: Process multiple wallets simultaneously 
- **Interactive UI**: User-friendly terminal interface for easy configuration and operation
- **Comprehensive Logging**: Detailed logs for tracking operations and troubleshooting

## Supported Chains

- un10n (un10n-testnet-9)
- Babylon (bbn-test-5)
- Stargaze (elgafar-1)
- Stride (stride-internal-1)

## Prerequisites

- Node.js (v16+)
- NPM or Yarn
- Basic knowledge of Cosmos SDK blockchains
- Private key(s) for interacting with the chains

## Installation

1. Clone the repository:

```bash
git clone https://github.com/Usernameusernamenotavailbleisnot/un10n.git
cd un10n
```

2. Install dependencies:

```bash
npm install
```

3. Fix required modules (necessary for compatibility with some Cosmos chains):

```bash
node fix.js
```

4. Create a private key file:

```bash
# Add your private keys in pk.txt (one per line)
echo "your_private_key_here" > pk.txt
```

## Configuration

The bot uses configuration files for chains and quests:

- `config/chains.js`: Configuration for supported blockchain networks
- `config/quests.js`: Definition of daily, transfer, and cross-chain quests

All configurations are loaded automatically when starting the application.

## Usage

Start the interactive UI:

```bash
npm start
```

### Main Commands

- **Daily Interactions**: Execute minimum transfers to maintain daily interaction streaks
- **Transfer Quests**: Perform token transfers to complete transfer-based quests
- **Cross-Chain Quests**: Execute specific cross-chain transfer paths
- **Faucet Requests**: Request tokens from un10n and Stargaze testnet faucets
- **Full Automation**: Run all quest types in sequence
- **View Progress**: Check completion status for all quest types

### Testing Transfers

Test specific transfers between chains:

```bash
npm run test-transfer
```

Or with specific parameters:

```bash
npm run test-transfer -- --source un10n --dest BABYLON --amount 0.001 --wallet 1
```

### Faucet Requests

For faucet requests, you'll need a [Capsolver](https://capsolver.com) API key to solve CAPTCHA challenges.

## Wallet Management

The bot manages wallets and derives addresses for all supported chains automatically. Private keys are stored in `pk.txt` with one key per line.

## Progress Tracking

Quest progress is tracked locally in JSON files within the `data` directory and can be viewed through the interactive UI.

## Logging

Logs are stored in the `logs` directory:
- `combined.log`: All log messages
- `error.log`: Error messages only
- `wallet-X.log`: Logs specific to wallet X

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is for educational and testing purposes only. Use at your own risk and only on testnet environments.
