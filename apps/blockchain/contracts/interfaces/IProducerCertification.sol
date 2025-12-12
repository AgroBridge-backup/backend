// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IProducerCertification
 * @notice Interface for the ProducerCertification contract.
 * @dev Defines the external function required by other contracts to check producer status.
 */
interface IProducerCertification {
    /**
     * @notice Checks if a given address is a certified producer.
     * @param producerAddress The address to check.
     * @return A boolean indicating if the producer is certified and active.
     */
    function isProducerCertified(address producerAddress) external view returns (bool);
}
