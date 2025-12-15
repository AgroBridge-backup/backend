export const typeDefs = `
  # ═══════════════════════════════════════════════════════════════════════════════
  # SCALARS
  # ═══════════════════════════════════════════════════════════════════════════════

  scalar DateTime
  scalar JSON
  scalar Decimal

  # ═══════════════════════════════════════════════════════════════════════════════
  # ENUMS (Matching Prisma schema exactly)
  # ═══════════════════════════════════════════════════════════════════════════════

  enum UserRole {
    ADMIN
    PRODUCER
    CERTIFIER
    BUYER
  }

  enum BatchStatus {
    REGISTERED
    IN_TRANSIT
    ARRIVED
    DELIVERED
    REJECTED
  }

  enum EventType {
    HARVEST
    PROCESSING
    QUALITY_INSPECTION
    PACKAGING
    TRANSPORT_START
    TRANSPORT_ARRIVAL
    CUSTOMS_CLEARANCE
    DELIVERY
  }

  enum CertificationType {
    GLOBALGAP
    ORGANIC_USDA
    ORGANIC_EU
    RAINFOREST_ALLIANCE
    FAIR_TRADE
    SENASICA
  }

  enum Variety {
    HASS
    BERRIES
  }

  enum SortDirection {
    ASC
    DESC
  }

  # ═══════════════════════════════════════════════════════════════════════════════
  # INPUT TYPES
  # ═══════════════════════════════════════════════════════════════════════════════

  input PaginationInput {
    page: Int = 1
    limit: Int = 20
    cursor: String
  }

  input DateRangeInput {
    from: DateTime
    to: DateTime
  }

  input BatchFilterInput {
    status: [BatchStatus!]
    producerId: String
    origin: String
    variety: Variety
    createdAt: DateRangeInput
    weightKgMin: Float
    weightKgMax: Float
  }

  input BatchSortInput {
    field: BatchSortField!
    direction: SortDirection!
  }

  enum BatchSortField {
    createdAt
    updatedAt
    weightKg
    status
    origin
    harvestDate
  }

  input ProducerFilterInput {
    isWhitelisted: Boolean
    state: String
    municipality: String
    createdAt: DateRangeInput
  }

  input ProducerSortInput {
    field: ProducerSortField!
    direction: SortDirection!
  }

  enum ProducerSortField {
    createdAt
    updatedAt
    businessName
    state
  }

  input EventFilterInput {
    eventType: [EventType!]
    batchId: String
    createdById: String
    timestamp: DateRangeInput
  }

  input EventSortInput {
    field: EventSortField!
    direction: SortDirection!
  }

  enum EventSortField {
    timestamp
    eventType
    createdAt
  }

  input CreateBatchInput {
    variety: Variety!
    origin: String!
    harvestDate: DateTime!
    weightKg: Float!
    blockchainHash: String!
  }

  input UpdateBatchStatusInput {
    status: BatchStatus!
  }

  input CreateEventInput {
    batchId: String!
    eventType: EventType!
    latitude: Float!
    longitude: Float!
    locationName: String
    temperature: Float
    humidity: Float
    notes: String
    photos: [String!]
  }

  input CreateProducerInput {
    businessName: String!
    rfc: String!
    state: String!
    municipality: String!
    address: String
    latitude: Float!
    longitude: Float!
    totalHectares: Float
    cropTypes: [String!]
  }

  input UpdateProducerInput {
    businessName: String
    address: String
    totalHectares: Float
    cropTypes: [String!]
  }

  input AddCertificationInput {
    producerId: String!
    type: CertificationType!
    certifier: String!
    certificateNumber: String!
    issuedAt: DateTime!
    expiresAt: DateTime!
  }

  # ═══════════════════════════════════════════════════════════════════════════════
  # TYPES (Matching Prisma models)
  # ═══════════════════════════════════════════════════════════════════════════════

  type User {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    role: UserRole!
    walletAddress: String
    isActive: Boolean!
    lastLoginAt: DateTime
    twoFactorEnabled: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!

    # Computed
    fullName: String!
    producer: Producer
  }

  type Producer {
    id: ID!
    userId: String!
    businessName: String!
    rfc: String!
    state: String!
    municipality: String!
    address: String
    latitude: Float!
    longitude: Float!
    totalHectares: Float
    cropTypes: [String!]!
    isWhitelisted: Boolean!
    whitelistedAt: DateTime
    whitelistedBy: String
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relationships
    user: User!
    batches(pagination: PaginationInput, filter: BatchFilterInput, sort: BatchSortInput): BatchConnection!
    certifications: [Certification!]!

    # Computed fields
    batchCount: Int!
    activeBatchCount: Int!
  }

  type Batch {
    id: ID!
    producerId: String!
    variety: Variety!
    origin: String!
    weightKg: Float!
    harvestDate: DateTime!
    blockchainHash: String!
    status: BatchStatus!
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relationships
    producer: Producer!
    events(pagination: PaginationInput, filter: EventFilterInput, sort: EventSortInput): EventConnection!

    # Computed fields
    eventCount: Int!
    latestEvent: TraceabilityEvent
    timeline: [TimelineEntry!]!
  }

  type TraceabilityEvent {
    id: ID!
    batchId: String!
    eventType: EventType!
    timestamp: DateTime!
    latitude: Float!
    longitude: Float!
    locationName: String
    temperature: Float
    humidity: Float
    notes: String
    ipfsHash: String
    photos: [String!]!
    blockchainTxHash: String
    isVerified: Boolean!
    verifiedBy: String
    verifiedAt: DateTime
    createdById: String!
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relationships
    batch: Batch!
    createdBy: User!
    verifier: User
  }

  type Certification {
    id: ID!
    producerId: String!
    type: CertificationType!
    certifier: String!
    certificateNumber: String!
    ipfsHash: String
    issuedAt: DateTime!
    expiresAt: DateTime!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relationships
    producer: Producer!
  }

  type TimelineEntry {
    id: ID!
    eventType: EventType!
    title: String!
    timestamp: DateTime!
    locationName: String
    createdBy: User
  }

  # ═══════════════════════════════════════════════════════════════════════════════
  # CONNECTION TYPES (Pagination)
  # ═══════════════════════════════════════════════════════════════════════════════

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
    totalCount: Int!
    totalPages: Int!
    currentPage: Int!
  }

  type BatchConnection {
    edges: [BatchEdge!]!
    pageInfo: PageInfo!
    nodes: [Batch!]!
  }

  type BatchEdge {
    node: Batch!
    cursor: String!
  }

  type ProducerConnection {
    edges: [ProducerEdge!]!
    pageInfo: PageInfo!
    nodes: [Producer!]!
  }

  type ProducerEdge {
    node: Producer!
    cursor: String!
  }

  type EventConnection {
    edges: [EventEdge!]!
    pageInfo: PageInfo!
    nodes: [TraceabilityEvent!]!
  }

  type EventEdge {
    node: TraceabilityEvent!
    cursor: String!
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    nodes: [User!]!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  # ═══════════════════════════════════════════════════════════════════════════════
  # ANALYTICS TYPES
  # ═══════════════════════════════════════════════════════════════════════════════

  type DashboardStats {
    totalBatches: Int!
    activeBatches: Int!
    totalProducers: Int!
    whitelistedProducers: Int!
    totalEvents: Int!
    eventsToday: Int!
    batchesByStatus: [StatusCount!]!
    eventsByType: [TypeCount!]!
    recentActivity: [ActivityItem!]!
  }

  type StatusCount {
    status: BatchStatus!
    count: Int!
    percentage: Float!
  }

  type TypeCount {
    type: EventType!
    count: Int!
    percentage: Float!
  }

  type ActivityItem {
    id: ID!
    eventType: String!
    description: String!
    timestamp: DateTime!
    createdBy: User
    batchId: String
  }

  type BatchTimeline {
    date: DateTime!
    registered: Int!
    inTransit: Int!
    arrived: Int!
    delivered: Int!
    rejected: Int!
  }

  type ProducerStats {
    producerId: ID!
    producer: Producer!
    totalBatches: Int!
    activeBatches: Int!
    deliveredBatches: Int!
    totalWeightKg: Float!
    averageWeightKg: Float!
    certificationCount: Int!
  }

  type TopProducer {
    producer: Producer!
    batchCount: Int!
    totalWeightKg: Float!
    rank: Int!
  }

  type EventDistribution {
    type: EventType!
    count: Int!
    percentage: Float!
    lastOccurrence: DateTime
  }

  type SystemOverview {
    totalUsers: Int!
    activeUsers: Int!
    usersByRole: [RoleCount!]!
    totalBatches: Int!
    totalEvents: Int!
    totalProducers: Int!
    uptime: Float
  }

  type RoleCount {
    role: UserRole!
    count: Int!
  }

  # ═══════════════════════════════════════════════════════════════════════════════
  # MUTATION RESPONSES
  # ═══════════════════════════════════════════════════════════════════════════════

  interface MutationResponse {
    success: Boolean!
    message: String!
  }

  type BatchMutationResponse implements MutationResponse {
    success: Boolean!
    message: String!
    batch: Batch
  }

  type ProducerMutationResponse implements MutationResponse {
    success: Boolean!
    message: String!
    producer: Producer
  }

  type EventMutationResponse implements MutationResponse {
    success: Boolean!
    message: String!
    event: TraceabilityEvent
  }

  type CertificationMutationResponse implements MutationResponse {
    success: Boolean!
    message: String!
    certification: Certification
  }

  type DeleteMutationResponse implements MutationResponse {
    success: Boolean!
    message: String!
    deletedId: ID
  }

  # ═══════════════════════════════════════════════════════════════════════════════
  # QUERIES
  # ═══════════════════════════════════════════════════════════════════════════════

  type Query {
    # User queries
    me: User
    user(id: ID!): User
    users(pagination: PaginationInput): UserConnection!

    # Batch queries
    batch(id: ID!): Batch
    batches(
      pagination: PaginationInput
      filter: BatchFilterInput
      sort: BatchSortInput
    ): BatchConnection!

    # Producer queries
    producer(id: ID!): Producer
    producerByUserId(userId: ID!): Producer
    producers(
      pagination: PaginationInput
      filter: ProducerFilterInput
      sort: ProducerSortInput
    ): ProducerConnection!

    # Event queries
    event(id: ID!): TraceabilityEvent
    events(
      pagination: PaginationInput
      filter: EventFilterInput
      sort: EventSortInput
    ): EventConnection!
    eventsByBatch(batchId: ID!, pagination: PaginationInput): EventConnection!

    # Analytics queries (Admin/Certifier only)
    dashboard: DashboardStats!
    batchTimeline(
      startDate: DateTime!
      endDate: DateTime!
      granularity: String
    ): [BatchTimeline!]!
    producerStats(producerId: ID!): ProducerStats
    topProducers(limit: Int): [TopProducer!]!
    eventDistribution(dateRange: DateRangeInput): [EventDistribution!]!
    systemOverview: SystemOverview!

    # Search
    search(query: String!, types: [String!]): SearchResults!
  }

  type SearchResults {
    batches: [Batch!]!
    producers: [Producer!]!
    events: [TraceabilityEvent!]!
    totalCount: Int!
  }

  # ═══════════════════════════════════════════════════════════════════════════════
  # MUTATIONS
  # ═══════════════════════════════════════════════════════════════════════════════

  type Mutation {
    # Batch mutations
    createBatch(input: CreateBatchInput!): BatchMutationResponse!
    updateBatchStatus(id: ID!, input: UpdateBatchStatusInput!): BatchMutationResponse!
    deleteBatch(id: ID!): DeleteMutationResponse!

    # Event mutations
    createEvent(input: CreateEventInput!): EventMutationResponse!
    verifyEvent(id: ID!): EventMutationResponse!

    # Producer mutations (Admin only)
    createProducer(userId: ID!, input: CreateProducerInput!): ProducerMutationResponse!
    updateProducer(id: ID!, input: UpdateProducerInput!): ProducerMutationResponse!
    whitelistProducer(id: ID!): ProducerMutationResponse!
    deleteProducer(id: ID!): DeleteMutationResponse!

    # Certification mutations
    addCertification(input: AddCertificationInput!): CertificationMutationResponse!
  }

  # ═══════════════════════════════════════════════════════════════════════════════
  # SUBSCRIPTIONS (Placeholder)
  # ═══════════════════════════════════════════════════════════════════════════════

  type Subscription {
    batchCreated: Batch!
    batchStatusChanged(id: ID): Batch!
    eventCreated(batchId: ID): TraceabilityEvent!
    producerWhitelisted: Producer!
  }
`;
