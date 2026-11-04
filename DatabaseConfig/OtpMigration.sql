IF COL_LENGTH('Worktrialusers', 'otp') IS NULL
    ALTER TABLE Worktrialusers ADD otp VARCHAR(6) NULL;

IF COL_LENGTH('Worktrialusers', 'otpupdatedat') IS NULL
    ALTER TABLE Worktrialusers ADD otpupdatedat DATETIME2 NULL;