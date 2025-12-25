export class ListExportCompaniesUseCase {
    companyService;
    constructor(companyService) {
        this.companyService = companyService;
    }
    async execute(request) {
        const limit = Math.min(request.limit || 20, 100);
        const offset = request.offset || 0;
        const result = await this.companyService.listCompanies({
            status: request.status,
            tier: request.tier,
            search: request.search,
            limit,
            offset,
        });
        return {
            companies: result.companies,
            total: result.total,
            limit,
            offset,
        };
    }
}
