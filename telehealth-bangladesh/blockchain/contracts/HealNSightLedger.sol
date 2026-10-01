// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title HealNSightLedger
 * @notice Immutable Audit Ledger for Telehealth Bangladesh Medical & Prescription Records.
 * @dev Anchors SHA-256 cryptographic hashes of patient health records and prescriptions onto Ethereum Sepolia.
 */
contract HealNSightLedger {
    struct Record {
        uint256 id;
        bytes32 recordHash;
        bytes32 previousHash;
        string recordType;
        uint256 timestamp;
        string referenceId;
        address submittedBy;
    }

    // Mapping from record sequential ID to Record data
    mapping(uint256 => Record) public records;
    uint256 public recordCount;

    // Mapping to check if a specific local ID + type combination is already registered
    // key: keccak256(abi.encodePacked(recordType, referenceId))
    mapping(bytes32 => uint256) public recordIdMap;

    event RecordAnchored(
        uint256 indexed id,
        bytes32 indexed recordHash,
        bytes32 previousHash,
        string recordType,
        uint256 timestamp,
        string referenceId,
        address indexed submittedBy
    );

    /**
     * @notice Commits a cryptographic hash of a medical record or prescription on-chain.
     * @param _recordHash SHA-256 hash of the record contents
     * @param _previousHash Hash of the preceding block in the ledger chain
     * @param _recordType Type descriptor ("prescription", "health_record", "consent")
     * @param _referenceId Local database primary key identifier
     */
    function addRecord(
        bytes32 _recordHash,
        bytes32 _previousHash,
        string memory _recordType,
        string memory _referenceId
    ) public returns (uint256) {
        bytes32 mapKey = keccak256(abi.encodePacked(_recordType, _referenceId));
        require(recordIdMap[mapKey] == 0, "Record already anchored on-chain");

        recordCount++;
        uint256 newId = recordCount;

        records[newId] = Record({
            id: newId,
            recordHash: _recordHash,
            previousHash: _previousHash,
            recordType: _recordType,
            timestamp: block.timestamp,
            referenceId: _referenceId,
            submittedBy: msg.sender
        });

        recordIdMap[mapKey] = newId;

        emit RecordAnchored(
            newId,
            _recordHash,
            _previousHash,
            _recordType,
            block.timestamp,
            _referenceId,
            msg.sender
        );

        return newId;
    }

    /**
     * @notice Retrieves record details by sequential block identifier.
     */
    function getRecord(uint256 _id) public view returns (
        uint256 id,
        bytes32 recordHash,
        bytes32 previousHash,
        string memory recordType,
        uint256 timestamp,
        string memory referenceId,
        address submittedBy
    ) {
        require(_id > 0 && _id <= recordCount, "Record does not exist");
        Record memory rec = records[_id];
        return (
            rec.id,
            rec.recordHash,
            rec.previousHash,
            rec.recordType,
            rec.timestamp,
            rec.referenceId,
            rec.submittedBy
        );
    }

    /**
     * @notice Verifies if a given hash matches the stored on-chain record hash.
     */
    function verifyRecord(uint256 _id, bytes32 _recordHash) public view returns (bool) {
        if (_id == 0 || _id > recordCount) {
            return false;
        }
        return records[_id].recordHash == _recordHash;
    }

    /**
     * @notice Finds the on-chain sequential ID for a given record type and reference identifier.
     */
    function getRecordId(string memory _recordType, string memory _referenceId) public view returns (uint256) {
        bytes32 mapKey = keccak256(abi.encodePacked(_recordType, _referenceId));
        return recordIdMap[mapKey];
    }
}
