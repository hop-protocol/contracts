export const tokens = {
  DAI: {
    kovan: {
      l1CanonicalToken: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
      l1Bridge: '0xB4585D433075bdF1B503C1e5ca8431999F7042C6'
    },
    arbitrum: {
      l1CanonicalBridge: '0xE681857DEfE8b454244e701BA63EfAa078d7eA85',
      l1CanonicalMessenger: '0xE681857DEfE8b454244e701BA63EfAa078d7eA85',
      l2CanonicalBridge: '0x0000000000000000000000000000000000000064',
      l2CanonicalMessenger: '0x0000000000000000000000000000000000000064',
      l2CanonicalToken: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
      L2_HopBridgeToken: '0xac9db0707bBC106B1Acd9CCDc07EdB9ED190108b',
      l2Bridge: '0x9a57ED0207EE95Aa580253dBaef9FDf4A478FcBc',
      uniswapRouter: '0x5B64A7A5c5C4F61e8bEABB721c5988016D9b1587',
      uniswapFactory: '0x5006BB088D06dEBA783a54769Bf8a883bBaDDA6a',
      uniswapExchange: '0x3cb14029f46D7A4Ee346A2b1F61C8e5bACD86341'
    },
    optimism: {
      l1CanonicalBridge: '0xA6e9F1409fe85c84CEACD5936800A12d721009cE',
      l1CanonicalMessenger: '0x77eeDe6CC8B46C76e50979Ce3b4163253979c519',
      l2CanonicalBridge: '0x6d2f304CFF4e0B67dA4ab38C6A5C8184a2424D05',
      l2CanonicalMessenger: '0x6d2f304CFF4e0B67dA4ab38C6A5C8184a2424D05',
      l2CanonicalToken: '0x57eaeE3D9C99b93D8FD1b50EF274579bFEC8e14B',
      L2_HopBridgeToken: 'todo',
      l2Bridge: '0x6d2f304CFF4e0B67dA4ab38C6A5C8184a2424D05',
      uniswapRouter: 'todo',
      uniswapFactory: 'todo',
      uniswapExchange: 'todo'
    },
    xdai: {
      l1CanonicalBridge: '0xA960d095470f7509955d5402e36d9DB984B5C8E2',
      l1CanonicalMessenger: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
      l2CanonicalBridge: '0x40CdfF886715A4012fAD0219D15C98bB149AeF0e',
      l2CanonicalMessenger: '0x40CdfF886715A4012fAD0219D15C98bB149AeF0e',
      l2CanonicalToken: '0x714983a8Dc3329bf3BeB8F36b49878CF944E5A3B',
      L2_HopBridgeToken: '0x5006BB088D06dEBA783a54769Bf8a883bBaDDA6a',
      l2Bridge: '0x20460c559C5e11F9936455E038ff5dbB731C0A50',
      uniswapRouter: '0x9a57ED0207EE95Aa580253dBaef9FDf4A478FcBc',
      uniswapFactory: '0x5B64A7A5c5C4F61e8bEABB721c5988016D9b1587',
      uniswapExchange: '0xc95EB7acC44cdFD54693C5b82e873C26Ab1Efc89',
      l1Amb: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
      l2Amb: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560'
    }
  },
  ARB: {
    kovan: {
      l1CanonicalToken: '0xE41d965f6e7541139f8D9F331176867FB6972Baf',
      l1Bridge: '0x0E5a812ebA2b17B2Aea3E50Ed05518668839afa9'
    },
    arbitrum: {
      l1CanonicalBridge: '0xE681857DEfE8b454244e701BA63EfAa078d7eA85',
      l1CanonicalMessenger: '0xE681857DEfE8b454244e701BA63EfAa078d7eA85',
      l2CanonicalBridge: '0x0000000000000000000000000000000000000064',
      l2CanonicalMessenger: '0x0000000000000000000000000000000000000064',
      l2CanonicalToken: '0xE41d965f6e7541139f8D9F331176867FB6972Baf',
      L2_HopBridgeToken: '0x427aA184ce8bDC92c0B4dDf19A5b9A3D5B7F45BC',
      l2Bridge: '0xAb00C81e9d90c5c068218FF1eaA8264FcDf5f5fB',
      uniswapRouter: '0x653616AFcD6f4D645d8d5A08b3F74e140f981b00',
      uniswapFactory: '0x880046478C059643B6624452Af203F5CC478E3AC',
      uniswapExchange: '0x67ef9648f7c45087fCc85eA7b2F1fe79f07D52be'
    }
  }
}
// export const addresses = {
//   mainnet: {},
//   kovan: {
//     l1Token: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
//     l1Bridge: '0xe74EFb19BBC46DbE28b7BaB1F14af6eB7158B4BE',
//     networks: {
//       arbitrum: {
//         testnet3: {
//           l1CanonicalBridge: '0x2e8aF9f74046D3E55202Fcfb893348316B142230',
//           l1CanonicalMessenger: '0xE681857DEfE8b454244e701BA63EfAa078d7eA85',
//           l2CanonicalMessenger: '0x0000000000000000000000000000000000000064',
//           l2CanonicalToken: '0x7d669a64deb8a4a51eea755bb0e19fd39ce25ae9',
//           l2Bridge: '0xf3af9B1Edc17c1FcA2b85dd64595F914fE2D3Dde',
//           uniswapFactory: '0xd28B241aB439220b85b8B90B912799DefECA8CCe',
//           uniswapRouter: '0x2B6812d2282CF676044cBdE2D0222c08e6E1bdb2',
//           arbChain: '0x2e8aF9f74046D3E55202Fcfb893348316B142230'
//         }
//       },
//       optimism: {
//         hopTestnet: {
//           l1CanonicalBridge: '0xA6e9F1409fe85c84CEACD5936800A12d721009cE',
//           l1CanonicalMessenger: '0x77eeDe6CC8B46C76e50979Ce3b4163253979c519',
//           l2CanonicalBridge: '0x61cBe9766fe7392A4DE03A54b2069c103AE674eb',
//           l2CanonicalToken: '0x57eaeE3D9C99b93D8FD1b50EF274579bFEC8e14B',
//           l2Bridge: '0x6d2f304CFF4e0B67dA4ab38C6A5C8184a2424D05',
//           uniswapFactory: '0x3e4CFaa8730092552d9425575E49bB542e329981',
//           uniswapRouter: '0x3C67B82D67B4f31A54C0A516dE8d3e93D010EDb3'
//         }
//       }
//     }
//   }
// }
