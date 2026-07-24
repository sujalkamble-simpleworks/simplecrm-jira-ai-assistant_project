-- admin_accounts table
-- Stores only the dedicated administrator logins.
CREATE TABLE IF NOT EXISTS admin_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- users table
-- Stores normal user accounts and their role/module access.
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) DEFAULT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- user_module_access table
-- Stores which modules each non-admin user can use.
CREATE TABLE IF NOT EXISTS user_module_access (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_module (user_id, module_name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- user_integrations table
-- Stores per-user integration credentials for Jira and Tempo.
-- Tokens are stored in plain text.

CREATE TABLE IF NOT EXISTS user_integrations (
    id                        INT AUTO_INCREMENT PRIMARY KEY,
    user_id                   INT NOT NULL,
    jira_email                VARCHAR(255) DEFAULT NULL,
    jira_api_token            TEXT DEFAULT NULL,
    jira_domain               VARCHAR(255) DEFAULT NULL,
    jira_project_key          VARCHAR(50) DEFAULT NULL,
    tempo_token               TEXT DEFAULT NULL,
    author_account_id         VARCHAR(255) DEFAULT NULL,
    tempo_account             VARCHAR(255) DEFAULT NULL,
    jira_reporter_account_id  VARCHAR(255) DEFAULT NULL,
    created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_id (user_id)
);
