import { describe, it, expect, vi } from 'vitest';
import { ListProducersUseCase, ListProducersRequestDto } from '../../../src/application/use-cases/producers/ListProducersUseCase';
import { IProducerRepository } from '../../../src/domain/repositories/IProducerRepository';

// Mock the repository
const mockProducerRepository: IProducerRepository = {
  find: vi.fn(),
  findById: vi.fn(),
};

describe('ListProducersUseCase', () => {
  it('should call the repository with the correct parameters', async () => {
    // FIX 2025: Unit test created by QA auditor to ensure use case correctness.
    // This test validates that the use case correctly forwards its input DTO
    // to the repository layer without modification.

    // Arrange
    const listProducersUseCase = new ListProducersUseCase(mockProducerRepository);
    const requestDto: ListProducersRequestDto = {
      page: 2,
      limit: 25,
      isWhitelisted: true,
      state: 'Michoacán',
    };

    const mockResponse = { producers: [], total: 0 };
    vi.mocked(mockProducerRepository.find).mockResolvedValue(mockResponse);

    // Act
    await listProducersUseCase.execute(requestDto);

    // Assert
    expect(mockProducerRepository.find).toHaveBeenCalledOnce();
    expect(mockProducerRepository.find).toHaveBeenCalledWith(requestDto);
  });

  it('should return the data provided by the repository', async () => {
    // Arrange
    const listProducersUseCase = new ListProducersUseCase(mockProducerRepository);
    const requestDto: ListProducersRequestDto = { page: 1, limit: 10 };
    
    const mockProducers = [{ id: '1', businessName: 'Test Producer' }];
    const mockResponse = { producers: mockProducers as any, total: 1 };
    vi.mocked(mockProducerRepository.find).mockResolvedValue(mockResponse);

    // Act
    const result = await listProducersUseCase.execute(requestDto);

    // Assert
    expect(result).toEqual(mockResponse);
  });
});
