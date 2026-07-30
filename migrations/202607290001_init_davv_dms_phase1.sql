CREATE TABLE staff_users (
  staff_id VARCHAR(50) PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE branches (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE subjects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE records (
  id CHAR(36) PRIMARY KEY,
  reference_number VARCHAR(100) NOT NULL UNIQUE,
  branch_id INT NOT NULL,
  subject_id INT NOT NULL,
  record_date DATE NOT NULL,
  remark TEXT NULL,
  staff_id VARCHAR(50) NOT NULL,
  record_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  total_pages INT NOT NULL DEFAULT 0,
  document_type VARCHAR(20) NOT NULL,
  document_size_bytes BIGINT NOT NULL DEFAULT 0,
  directory_name VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_records_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_records_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
  CONSTRAINT fk_records_staff FOREIGN KEY (staff_id) REFERENCES staff_users(staff_id)
);

CREATE TABLE record_files (
  id CHAR(36) PRIMARY KEY,
  record_id CHAR(36) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  page_count INT NULL,
  category_label VARCHAR(100) NULL,
  relative_path VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_record_files_record FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
);

CREATE INDEX idx_records_record_date ON records(record_date DESC);
CREATE INDEX idx_records_branch_id ON records(branch_id);
CREATE INDEX idx_records_subject_id ON records(subject_id);
CREATE INDEX idx_records_reference_number ON records(reference_number);
CREATE FULLTEXT INDEX idx_records_remark ON records(remark);
CREATE INDEX idx_record_files_record_id ON record_files(record_id);

INSERT INTO staff_users (staff_id, username, password_hash, display_name) VALUES
  (
    'DAVV-1001',
    'admin',
    'scrypt:davvdmsphase1salt:fc4d6913a345f6e7603f9e68d675fecaa85bb28740603487a12b4be4665a3369a4bafecc360294b3e2c303edbcda673e6b4c8df128167fb5f03a790bfc652a61',
    'DAVV Records Officer'
  );

INSERT INTO branches (name) VALUES
  ('Administration'),
  ('Examination'),
  ('Accounts'),
  ('Affiliation');

INSERT INTO subjects (name) VALUES
  ('Circular'),
  ('Academic Order'),
  ('Finance Approval'),
  ('Student Services');
