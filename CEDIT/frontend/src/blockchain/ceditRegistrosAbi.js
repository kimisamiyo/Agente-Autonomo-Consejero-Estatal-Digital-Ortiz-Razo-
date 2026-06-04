/** ABI mínima — CeditRegistros (zkTanenbaum) */
export const CEDIT_REGISTROS_ABI = [
  {
    inputs: [
      { internalType: 'string', name: 'channel', type: 'string' },
      { internalType: 'string', name: 'userHash', type: 'string' },
      { internalType: 'string', name: 'conversationText', type: 'string' },
    ],
    name: 'mintRegistroSelf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'recipient', type: 'address' },
      { indexed: false, internalType: 'string', name: 'channel', type: 'string' },
      { indexed: false, internalType: 'string', name: 'userHash', type: 'string' },
    ],
    name: 'RegistroAcunado',
    type: 'event',
  },
];
