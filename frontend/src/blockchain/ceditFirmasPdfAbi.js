/** ABI mínima — CeditFirmasPdf.mintFirmaPdfSelf (zkTanenbaum) */
export const CEDIT_FIRMAS_PDF_ABI = [
  {
    inputs: [
      { internalType: 'bytes32', name: 'pdfHash', type: 'bytes32' },
      { internalType: 'string', name: 'channelUrl', type: 'string' },
      { internalType: 'string', name: 'channel', type: 'string' },
      { internalType: 'uint16', name: 'mefScore', type: 'uint16' },
    ],
    name: 'mintFirmaPdfSelf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'recipient', type: 'address' },
      { indexed: true, internalType: 'bytes32', name: 'pdfHash', type: 'bytes32' },
      { indexed: false, internalType: 'string', name: 'channel', type: 'string' },
      { indexed: false, internalType: 'string', name: 'channelUrl', type: 'string' },
      { indexed: false, internalType: 'uint16', name: 'mefScore', type: 'uint16' },
    ],
    name: 'FirmaPdfAcunada',
    type: 'event',
  },
];
