jest.mock('../src/db/pool', () => ({
  query: jest.fn()
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,TEST')
}));

jest.mock('../src/services/emailService', () => ({
  sendVisitorSigninNotification: jest.fn().mockResolvedValue({ sent: false, skipped: true }),
  sendDailyVisitorReport: jest.fn().mockResolvedValue({ sent: false, skipped: true })
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const pool = require('../src/db/pool');

describe('Visitor sign-in routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates public visitor sign-in', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'v1',
          visit_date: '2026-03-10',
          full_name: 'Jane Visitor',
          company: 'NIS',
          appointment_with: 'Rebecca Bunch',
          clearance_level: 'secret',
          clearance_level_other: null,
          us_citizen: 'yes',
          id_type: 'state id',
          id_type_other: null,
          time_in: '08:30',
          time_out: '',
          badge_number: '1234',
          submitted_at: '2026-03-10T12:00:00.000Z'
        }
      ]
    });

    const response = await request(app).post('/api/visitor-signins/public').send({
      full_name: 'Jane Visitor',
      company: 'NIS',
      appointment_with: 'Rebecca Bunch',
      clearance_level: 'secret',
      us_citizen: 'yes',
      id_type: 'state id',
      time_in: '08:30',
      time_out: '',
      badge_number: '1234'
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.signin.full_name).toBe('Jane Visitor');
    expect(response.body.signin.badge_number).toBe('1234');
    expect(response.body.email_notification).toBeDefined();
  });

  test('rejects invalid time format', async () => {
    const response = await request(app).post('/api/visitor-signins/public').send({
      full_name: 'Jane Visitor',
      company: 'NIS',
      appointment_with: 'Rebecca Bunch',
      clearance_level: 'secret',
      us_citizen: 'yes',
      id_type: 'state id',
      time_in: '8.30',
      badge_number: '1234'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Time in');
  });

  test('rejects non-numeric badge number', async () => {
    const response = await request(app).post('/api/visitor-signins/public').send({
      full_name: 'Jane Visitor',
      company: 'NIS',
      appointment_with: 'Rebecca Bunch',
      clearance_level: 'secret',
      us_citizen: 'yes',
      id_type: 'state id',
      time_in: '08:30',
      badge_number: '12A4'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('numbers only');
  });

  test('sends daily report email', async () => {
    const token = jwt.sign({ id: 'u1', role: 'admin' }, process.env.JWT_SECRET || 'dev_jwt_secret');
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'v1',
          visit_date: '2026-03-10',
          full_name: 'Jane Visitor',
          company: 'NIS',
          appointment_with: 'Rebecca Bunch',
          clearance_level: 'secret',
          us_citizen: 'yes',
          id_type: 'state id',
          time_in: '08:30',
          time_out: '',
          badge_number: '1234',
          submitted_at: '2026-03-10T12:00:00.000Z'
        }
      ]
    });

    const response = await request(app)
      .post('/api/visitor-signins/report/daily')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-03-10' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
  });

  test('returns QR metadata', async () => {
    const response = await request(app).get('/api/visitor-signins/qr');

    expect(response.status).toBe(200);
    expect(response.body.url).toContain('/visitor-signin');
    expect(response.body.image_data_url).toContain('data:image/png;base64');
  });
});
