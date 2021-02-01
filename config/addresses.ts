export const addresses = {
  mainnet: {},
  kovan: {
    l1Token: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
    l1Bridge: '0xe74EFb19BBC46DbE28b7BaB1F14af6eB7158B4BE',
    networks: {
      arbitrum: {
        testnet3: {
          l1CanonicalBridge: '0x2e8aF9f74046D3E55202Fcfb893348316B142230',
          l1CanonicalMessenger: '0xE681857DEfE8b454244e701BA63EfAa078d7eA85',
          l2CanonicalMessenger: '0x0000000000000000000000000000000000000064',
          l2CanonicalToken: '0x7d669a64deb8a4a51eea755bb0e19fd39ce25ae9',
          l2Bridge: '0xf3af9B1Edc17c1FcA2b85dd64595F914fE2D3Dde',
          uniswapFactory: '0xd28B241aB439220b85b8B90B912799DefECA8CCe',
          uniswapRouter: '0x2B6812d2282CF676044cBdE2D0222c08e6E1bdb2',
          arbChain: '0x2e8aF9f74046D3E55202Fcfb893348316B142230'
        }
      },
      optimism: {
        hopTestnet: {
          l1CanonicalBridge: '0xA6e9F1409fe85c84CEACD5936800A12d721009cE',
          l1CanonicalMessenger: '0x77eeDe6CC8B46C76e50979Ce3b4163253979c519',
          l2CanonicalBridge: '0x61cBe9766fe7392A4DE03A54b2069c103AE674eb',
          l2CanonicalToken: '0x57eaeE3D9C99b93D8FD1b50EF274579bFEC8e14B',
          l2Bridge: '0x6d2f304CFF4e0B67dA4ab38C6A5C8184a2424D05',
          uniswapFactory: '0x3e4CFaa8730092552d9425575E49bB542e329981',
          uniswapRouter: '0x3C67B82D67B4f31A54C0A516dE8d3e93D010EDb3'
        }
      }
    }
  }
}
