-- SAAMS reference schema (managed by Flask-SQLAlchemy / Flask-Migrate)

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    mobile VARCHAR(20),
    password_hash VARCHAR(256),
    role VARCHAR(20) NOT NULL DEFAULT 'student',
    department VARCHAR(80),
    year VARCHAR(20),
    employee_id VARCHAR(40),
    roll_number VARCHAR(40),
    profile_photo VARCHAR(255),
    is_verified BOOLEAN DEFAULT 0,
    google_id VARCHAR(120) UNIQUE,
    dark_mode BOOLEAN DEFAULT 0,
    created_at DATETIME
);

CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    code VARCHAR(6) NOT NULL,
    expires_at DATETIME NOT NULL,
    is_used BOOLEAN DEFAULT 0,
    purpose VARCHAR(30) DEFAULT 'verification'
);

CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    event_name VARCHAR(200),
    organizer VARCHAR(200),
    event_date DATE,
    rank VARCHAR(80),
    level VARCHAR(40),
    description TEXT,
    status VARCHAR(30) DEFAULT 'Draft',
    mentor_comment TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at DATETIME,
    created_at DATETIME,
    updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES users(id),
    activity_name VARCHAR(200) NOT NULL,
    activity_type VARCHAR(80),
    role VARCHAR(80),
    date DATE,
    duration VARCHAR(50),
    organizer VARCHAR(200),
    description TEXT,
    status VARCHAR(30) DEFAULT 'Draft',
    mentor_comment TEXT,
    created_at DATETIME
);

CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    achievement_id INTEGER REFERENCES achievements(id),
    activity_id INTEGER REFERENCES activities(id),
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    extracted_text TEXT,
    detected_name VARCHAR(200),
    detected_event VARCHAR(200),
    detected_date VARCHAR(50),
    match_score FLOAT DEFAULT 0,
    verification_status VARCHAR(50),
    confidence_score FLOAT DEFAULT 0,
    authenticity_score FLOAT DEFAULT 0,
    uploaded_at DATETIME
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100),
    details TEXT,
    created_at DATETIME
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(200),
    message TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_resolved BOOLEAN DEFAULT 0,
    conversation_id VARCHAR(64)
);
