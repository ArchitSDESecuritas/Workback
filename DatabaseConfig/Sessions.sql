IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sessions (
        sid NVARCHAR(255) NOT NULL PRIMARY KEY,
        session NVARCHAR(MAX) NOT NULL,
        expires DATETIME NOT NULL
    );
END;
GO