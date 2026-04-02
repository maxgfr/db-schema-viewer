export interface SchemaTemplate {
  name: string;
  description: string;
  category: string;
  sql: string;
  /** Synthesized filename for format detection (e.g., "schema.ts" for Drizzle). Defaults to SQL. */
  fileName?: string;
}

export const SCHEMA_TEMPLATES: SchemaTemplate[] = [
  {
    name: "Social Network",
    description:
      "Social platform with users, friendships, posts, likes, messages, media, and notifications",
    category: "social",
    sql: `-- Social Network Schema (PostgreSQL)

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  bio TEXT,
  avatar_url VARCHAR(500),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_users_username ON users (username);

CREATE TABLE friendships (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  addressee_id INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships (requester_id);
CREATE INDEX idx_friendships_addressee ON friendships (addressee_id);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  visibility VARCHAR(20) DEFAULT 'public',
  location VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_posts_author ON posts (author_id);
CREATE INDEX idx_posts_created ON posts (created_at DESC);

CREATE TABLE media (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  url VARCHAR(500) NOT NULL,
  media_type VARCHAR(20) NOT NULL,
  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_post ON media (post_id);

CREATE TABLE likes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  post_id INTEGER NOT NULL REFERENCES posts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

CREATE INDEX idx_likes_post ON likes (post_id);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  receiver_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_sender ON messages (sender_id);
CREATE INDEX idx_messages_receiver ON messages (receiver_id);
CREATE INDEX idx_messages_conversation ON messages (sender_id, receiver_id, created_at DESC);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  actor_id INTEGER REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  reference_id INTEGER,
  reference_type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications (user_id, is_read, created_at DESC);`,
  },
  {
    name: "IoT Platform",
    description:
      "Internet of Things management with devices, sensors, readings, alerts, groups, and firmware tracking",
    category: "iot",
    sql: `-- IoT Platform Schema (PostgreSQL)

CREATE TABLE device_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  parent_group_id INTEGER REFERENCES device_groups(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE firmware_versions (
  id SERIAL PRIMARY KEY,
  version VARCHAR(50) NOT NULL UNIQUE,
  release_notes TEXT,
  checksum VARCHAR(128) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  is_stable BOOLEAN DEFAULT FALSE,
  released_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  serial_number VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  device_type VARCHAR(50) NOT NULL,
  group_id INTEGER REFERENCES device_groups(id),
  firmware_id INTEGER REFERENCES firmware_versions(id),
  status VARCHAR(20) DEFAULT 'offline',
  ip_address VARCHAR(45),
  mac_address VARCHAR(17),
  last_seen_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_group ON devices (group_id);
CREATE INDEX idx_devices_status ON devices (status);
CREATE INDEX idx_devices_serial ON devices (serial_number);

CREATE TABLE sensors (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id),
  name VARCHAR(100) NOT NULL,
  sensor_type VARCHAR(50) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  min_value NUMERIC(12, 4),
  max_value NUMERIC(12, 4),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sensors_device ON sensors (device_id);

CREATE TABLE readings (
  id BIGSERIAL PRIMARY KEY,
  sensor_id INTEGER NOT NULL REFERENCES sensors(id),
  value NUMERIC(16, 6) NOT NULL,
  quality INTEGER DEFAULT 100,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_readings_sensor_time ON readings (sensor_id, recorded_at DESC);

CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES devices(id),
  sensor_id INTEGER REFERENCES sensors(id),
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL,
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by VARCHAR(100),
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_alerts_device ON alerts (device_id);
CREATE INDEX idx_alerts_severity ON alerts (severity, is_acknowledged);`,
  },
  {
    name: "Learning Management System",
    description:
      "Education platform with students, instructors, courses, enrollments, lessons, assignments, submissions, and grades",
    category: "education",
    sql: `-- Learning Management System Schema (PostgreSQL)

CREATE TABLE instructors (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  title VARCHAR(50),
  department VARCHAR(100),
  bio TEXT,
  avatar_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  student_number VARCHAR(50) NOT NULL UNIQUE,
  enrollment_year INTEGER NOT NULL,
  program VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_students_number ON students (student_number);

CREATE TABLE courses (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  instructor_id INTEGER NOT NULL REFERENCES instructors(id),
  credits INTEGER DEFAULT 3,
  max_students INTEGER DEFAULT 30,
  semester VARCHAR(20) NOT NULL,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_courses_instructor ON courses (instructor_id);
CREATE INDEX idx_courses_semester ON courses (semester);

CREATE TABLE enrollments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  status VARCHAR(20) DEFAULT 'active',
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (student_id, course_id)
);

CREATE INDEX idx_enrollments_student ON enrollments (student_id);
CREATE INDEX idx_enrollments_course ON enrollments (course_id);

CREATE TABLE lessons (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  video_url VARCHAR(500),
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lessons_course ON lessons (course_id, sort_order);

CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  max_score NUMERIC(6, 2) NOT NULL DEFAULT 100,
  weight NUMERIC(5, 2) DEFAULT 1.0,
  due_date TIMESTAMPTZ NOT NULL,
  allow_late BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignments_course ON assignments (course_id);
CREATE INDEX idx_assignments_due ON assignments (due_date);

CREATE TABLE submissions (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  content TEXT,
  file_url VARCHAR(500),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  is_late BOOLEAN DEFAULT FALSE,
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX idx_submissions_assignment ON submissions (assignment_id);
CREATE INDEX idx_submissions_student ON submissions (student_id);

CREATE TABLE grades (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) UNIQUE,
  graded_by INTEGER NOT NULL REFERENCES instructors(id),
  score NUMERIC(6, 2) NOT NULL,
  feedback TEXT,
  graded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grades_submission ON grades (submission_id);`,
  },
  {
    name: "Analytics Dashboard",
    description:
      "Analytics platform with events, sessions, users, funnels, metrics, dashboards, and widgets",
    category: "analytics",
    sql: `-- Analytics Dashboard Schema (PostgreSQL)

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_external ON users (external_id);
CREATE INDEX idx_users_last_seen ON users (last_seen_at);

CREATE TABLE sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  session_token VARCHAR(128) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  country VARCHAR(2),
  city VARCHAR(100),
  device_type VARCHAR(20),
  browser VARCHAR(50),
  os VARCHAR(50),
  referrer VARCHAR(500),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER
);

CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_started ON sessions (started_at DESC);

CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_name VARCHAR(100) NOT NULL,
  page_url VARCHAR(500),
  properties JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_session ON events (session_id);
CREATE INDEX idx_events_user ON events (user_id);
CREATE INDEX idx_events_name_time ON events (event_name, timestamp DESC);

CREATE TABLE funnels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE funnel_steps (
  id SERIAL PRIMARY KEY,
  funnel_id INTEGER NOT NULL REFERENCES funnels(id),
  step_order INTEGER NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  filter_conditions JSONB DEFAULT '{}',
  UNIQUE (funnel_id, step_order)
);

CREATE INDEX idx_funnel_steps_funnel ON funnel_steps (funnel_id, step_order);

CREATE TABLE metrics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  query_definition JSONB NOT NULL,
  aggregation_type VARCHAR(20) NOT NULL DEFAULT 'count',
  time_granularity VARCHAR(20) DEFAULT 'day',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE dashboards (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE widgets (
  id SERIAL PRIMARY KEY,
  dashboard_id INTEGER NOT NULL REFERENCES dashboards(id),
  metric_id INTEGER REFERENCES metrics(id),
  title VARCHAR(255) NOT NULL,
  widget_type VARCHAR(30) NOT NULL DEFAULT 'line_chart',
  config JSONB DEFAULT '{}',
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 4,
  height INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_widgets_dashboard ON widgets (dashboard_id);`,
  },
];
