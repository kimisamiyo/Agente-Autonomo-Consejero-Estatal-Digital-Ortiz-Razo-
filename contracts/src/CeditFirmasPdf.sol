// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title CeditFirmasPdf
 * @dev ERC-721 que atestigua on-chain la firma del plan PDF oficial MEF
 *      cuando el expediente alcanza >= 80 % de aprobación estimada.
 */
contract CeditFirmasPdf is ERC721URIStorage, Ownable {
    using Strings for uint256;

    uint16 public constant MEF_APPROVAL_THRESHOLD = 80;

    uint256 private _nextTokenId;

    struct FirmaPdf {
        bytes32 pdfHash;
        string channelUrl;
        string channel;
        uint16 mefScore;
        uint256 timestamp;
    }

    mapping(uint256 => FirmaPdf) public firmas;

    event FirmaPdfAcunada(
        uint256 indexed tokenId,
        address indexed recipient,
        bytes32 indexed pdfHash,
        string channel,
        string channelUrl,
        uint16 mefScore
    );

    constructor() ERC721("CEDIT Firmas PDF", "CEDITPDF") Ownable(msg.sender) {
        _nextTokenId = 1;
    }

    function mintFirmaPdf(
        address recipient,
        bytes32 pdfHash,
        string calldata channelUrl,
        string calldata channel,
        uint16 mefScore
    ) external onlyOwner returns (uint256) {
        return _mintFirmaPdf(recipient, pdfHash, channelUrl, channel, mefScore);
    }

    /// @notice Web: el firmante acuña el NFT de firma PDF en su wallet.
    function mintFirmaPdfSelf(
        bytes32 pdfHash,
        string calldata channelUrl,
        string calldata channel,
        uint16 mefScore
    ) external returns (uint256) {
        return _mintFirmaPdf(msg.sender, pdfHash, channelUrl, channel, mefScore);
    }

    function _mintFirmaPdf(
        address recipient,
        bytes32 pdfHash,
        string calldata channelUrl,
        string calldata channel,
        uint16 mefScore
    ) internal returns (uint256) {
        require(pdfHash != bytes32(0), "CeditFirmasPdf: hash vacio");
        require(bytes(channelUrl).length > 0, "CeditFirmasPdf: URL de canal requerida");
        require(mefScore >= MEF_APPROVAL_THRESHOLD, "CeditFirmasPdf: MEF < 80%");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        firmas[tokenId] = FirmaPdf({
            pdfHash: pdfHash,
            channelUrl: channelUrl,
            channel: channel,
            mefScore: mefScore,
            timestamp: block.timestamp
        });

        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, _generateTokenURI(tokenId));

        emit FirmaPdfAcunada(tokenId, recipient, pdfHash, channel, channelUrl, mefScore);

        return tokenId;
    }

    function attestationUrl(uint256 tokenId) public view returns (string memory) {
        _requireOwned(tokenId);
        FirmaPdf memory f = firmas[tokenId];
        return string(
            abi.encodePacked(
                f.channelUrl,
                _querySeparator(f.channelUrl),
                "cedit_pdf_hash=0x",
                _bytes32ToHex(f.pdfHash)
            )
        );
    }

    function attestationDigest(uint256 tokenId) public view returns (bytes32) {
        _requireOwned(tokenId);
        FirmaPdf memory f = firmas[tokenId];
        return keccak256(abi.encodePacked(f.pdfHash, f.channelUrl));
    }

    function verifyPdfHash(uint256 tokenId, bytes32 expectedHash) external view returns (bool) {
        _requireOwned(tokenId);
        return firmas[tokenId].pdfHash == expectedHash;
    }

    function _generateTokenURI(uint256 tokenId) internal view returns (string memory) {
        FirmaPdf memory f = firmas[tokenId];
        string memory hashHex = _bytes32ToHex(f.pdfHash);
        string memory attUrl = attestationUrl(tokenId);

        string memory svg = _generateSVG(f.channel, hashHex, f.mefScore, f.timestamp);
        string memory svgBase64 = Base64.encode(bytes(svg));

        string memory attributes = string(
            abi.encodePacked(
                "[",
                '{"trait_type": "Canal", "value": "', f.channel, '"},',
                '{"trait_type": "Hash PDF (Keccak-256)", "value": "0x', hashHex, '"},',
                '{"trait_type": "URL del Canal", "value": "', _escapeJsonString(f.channelUrl), '"},',
                '{"trait_type": "Referencia de Atestacion", "value": "', _escapeJsonString(attUrl), '"},',
                '{"trait_type": "Indice MEF", "value": ', uint256(f.mefScore).toString(), "},",
                '{"trait_type": "Fecha de Firma (Unix)", "value": ', f.timestamp.toString(), "}",
                "]"
            )
        );

        string memory json = string(
            abi.encodePacked(
                "{",
                '"name": "Firma PDF CEDIT (', f.channel, ')",',
                '"description": "Atestacion on-chain de firma del plan PDF oficial MEF. Hash Keccak-256 del documento vinculado a la URL del canal ', f.channel, '. Indice MEF >= 80%.",',
                '"image": "data:image/svg+xml;base64,', svgBase64, '",',
                '"external_url": "', _escapeJsonString(attUrl), '",',
                '"attributes": ', attributes,
                "}"
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _generateSVG(
        string memory channel,
        string memory hashHex,
        uint16 mefScore,
        uint256 timestamp
    ) internal pure returns (string memory) {
        string memory shortHash = bytes(hashHex).length > 12
            ? string(abi.encodePacked(_substring(hashHex, 0, 8), "...", _substring(hashHex, bytes(hashHex).length - 4, bytes(hashHex).length)))
            : hashHex;

        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 350 350">',
                '<style>',
                '.bg { fill: #0F172A; }',
                '.title { fill: #AD0017; font-family: system-ui, sans-serif; font-size: 16px; font-weight: 800; }',
                '.label { fill: #64748B; font-family: system-ui, sans-serif; font-size: 11px; text-transform: uppercase; }',
                '.val { fill: #F8FAFC; font-family: system-ui, sans-serif; font-size: 12px; font-weight: 600; }',
                '.border { stroke: #0052FF; stroke-width: 2; fill: none; opacity: 0.9; }',
                '.status { fill: #10B981; font-family: system-ui, sans-serif; font-size: 11px; font-weight: 700; }',
                '</style>',
                '<rect width="100%" height="100%" class="bg"/>',
                '<rect x="15" y="15" width="320" height="320" rx="12" class="border"/>',
                '<text x="35" y="55" class="title">FIRMA PDF CEDIT</text>',
                '<text x="35" y="90" class="label">Canal</text>',
                '<text x="35" y="110" class="val">', channel, '</text>',
                '<text x="35" y="150" class="label">Keccak-256 (PDF)</text>',
                '<text x="35" y="170" class="val">0x', shortHash, '</text>',
                '<text x="35" y="210" class="label">Indice MEF</text>',
                '<text x="35" y="230" class="val">', uint256(mefScore).toString(), '%</text>',
                '<text x="35" y="270" class="label">Firma (Unix)</text>',
                '<text x="35" y="290" class="val">', timestamp.toString(), '</text>',
                '<text x="35" y="320" class="status">&#x2713; FIRMADO EN CADENA</text>',
                '</svg>'
            )
        );
    }

    function _querySeparator(string memory url) internal pure returns (string memory) {
        bytes memory b = bytes(url);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == "?") {
                return "&";
            }
        }
        return "?";
    }

    function _bytes32ToHex(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(data[i]);
            str[i * 2] = alphabet[b >> 4];
            str[i * 2 + 1] = alphabet[b & 0x0f];
        }
        return string(str);
    }

    function _escapeJsonString(string memory str) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        uint256 length = strBytes.length;
        uint256 extraLength = 0;
        for (uint256 i = 0; i < length; i++) {
            if (strBytes[i] == '"' || strBytes[i] == '\\' || strBytes[i] == '\n' || strBytes[i] == '\r') {
                extraLength++;
            }
        }
        if (extraLength == 0) {
            return str;
        }
        bytes memory result = new bytes(length + extraLength);
        uint256 rIndex = 0;
        for (uint256 i = 0; i < length; i++) {
            if (strBytes[i] == '"') {
                result[rIndex++] = '\\';
                result[rIndex++] = '"';
            } else if (strBytes[i] == '\\') {
                result[rIndex++] = '\\';
                result[rIndex++] = '\\';
            } else if (strBytes[i] == '\n') {
                result[rIndex++] = '\\';
                result[rIndex++] = 'n';
            } else if (strBytes[i] == '\r') {
                result[rIndex++] = '\\';
                result[rIndex++] = 'r';
            } else {
                result[rIndex++] = strBytes[i];
            }
        }
        return string(result);
    }

    function _substring(string memory str, uint256 startIndex, uint256 endIndex) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(endIndex - startIndex);
        for (uint256 i = startIndex; i < endIndex; i++) {
            result[i - startIndex] = strBytes[i];
        }
        return string(result);
    }
}
