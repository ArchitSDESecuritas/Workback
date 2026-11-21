CREATE TABLE PaymentTransactions (
    TransactionID INT IDENTITY(1,1) PRIMARY KEY,
    CandidateName NVARCHAR(200) NOT NULL,
    Email VARCHAR(255) NULL,
    Phone VARCHAR(30) NULL,
    OrganizationID INT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    Currency CHAR(3) NOT NULL CONSTRAINT DF_PaymentTransactions_Currency DEFAULT 'INR',
    RazorpayOrderID VARCHAR(80) NOT NULL CONSTRAINT UQ_PaymentTransactions_Order UNIQUE,
    RazorpayPaymentID VARCHAR(80) NULL,
    RazorpaySignature VARCHAR(255) NULL,
    Status VARCHAR(30) NOT NULL CONSTRAINT DF_PaymentTransactions_Status DEFAULT 'Created',
    InvoiceStatus VARCHAR(30) NOT NULL CONSTRAINT DF_PaymentTransactions_InvoiceStatus DEFAULT 'Pending',
    FailureReason NVARCHAR(500) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_PaymentTransactions_CreatedAt DEFAULT SYSUTCDATETIME(),
    PaidAt DATETIME2 NULL,
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_PaymentTransactions_UpdatedAt DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_PaymentTransactions_Status_CreatedAt
    ON PaymentTransactions (Status, CreatedAt);