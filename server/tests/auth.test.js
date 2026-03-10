const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const pool = require('../src/db/pool');

jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
  connect: jest.fn()
}));

describe('Auth routes', () => {
  test('registers a user', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'u1',
          email: 'new@example.com',
          first_name: 'New',
          last_name: 'User',
          role: 'viewer'
        }
      ]
    });

    const response = await request(app).post('/api/auth/register').send({
      email: 'new@example.com',
      password: 'pass123',
      first_name: 'New',
      last_name: 'User'
    });

    expect(response.status).toBe(201);
    expect(response.body.email).toBe('new@example.com');
  });

  test('logs in with valid credentials', async () => {
    const password_hash = await bcrypt.hash('pass123', 10);
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'u2',
          email: 'pm@example.com',
          password_hash,
          first_name: 'PM',
          last_name: 'User',
          role: 'proposal_manager'
        }
      ]
    });

    const response = await request(app).post('/api/auth/login').send({
      email: 'pm@example.com',
      password: 'pass123'
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.role).toBe('proposal_manager');
  });
});
