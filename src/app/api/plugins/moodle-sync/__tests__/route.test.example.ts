/**
 * Moodle-Sync Plugin Tests - Example Test Cases
 *
 * This file serves as a reference for writing tests for the moodle-sync plugin.
 * Uses Jest and @testing-library patterns consistent with existing Semetra tests.
 *
 * NOTE: This is an example file. Implement actual tests based on your testing framework.
 */

import { createMocks } from 'node-mocks-http';
import { GET, POST } from '../route';
import * as supabaseServer from '@/lib/supabase/server';
import * as moodleApi from '@/lib/plugins/moodle-api';

// Mock dependencies
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/plugins/moodle-api');

describe('Moodle-Sync Plugin API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── GET Tests ────────────────────────────────────────────────────────

  describe('GET /api/plugins/moodle-sync', () => {
    it('should return 401 without authentication', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
          }),
        },
      };

      (supabaseServer.createClient as jest.Mock).mockResolvedValue(
        mockSupabase
      );

      const { res } = createMocks({ method: 'GET' });
      await GET();

      expect(res._getStatusCode()).toBe(401);
    });

    it('should return connection status when connected', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn()
              .mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: {
                    config: {
                      moodle_url: 'https://moodle.example.ch',
                      token: 'token-123',
                      username: 'john.doe',
                      site_name: 'Example University',
                      last_sync: 1712396400000,
                      synced_courses: [{ moodleId: 15 }],
                    },
                  },
                }),
              }),
          }),
        }),
      };

      (supabaseServer.createClient as jest.Mock).mockResolvedValue(
        mockSupabase
      );

      const { res } = createMocks({ method: 'GET' });
      await GET();

      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());
      expect(json.connected).toBe(true);
      expect(json.moodle_url).toBe('https://moodle.example.ch');
      expect(json.username).toBe('john.doe');
      expect(json.synced_courses).toBe(1);
    });

    it('should return connection status when not connected', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn()
              .mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  error: { message: 'Not found' },
                }),
              }),
          }),
        }),
      };

      (supabaseServer.createClient as jest.Mock).mockResolvedValue(
        mockSupabase
      );

      const { res } = createMocks({ method: 'GET' });
      await GET();

      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());
      expect(json.connected).toBe(false);
      expect(json.moodle_url).toBeNull();
    });
  });

  // ── POST action="test" Tests ──────────────────────────────────────────

  describe('POST action="test"', () => {
    it('should test connection with valid credentials', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
      };

      (supabaseServer.createClient as jest.Mock).mockResolvedValue(
        mockSupabase
      );

      (moodleApi.testMoodleConnection as jest.Mock).mockResolvedValue({
        ok: true,
        siteInfo: {
          sitename: 'Example University Moodle',
          username: 'john.doe',
        },
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          action: 'test',
          moodle_url: 'https://moodle.example.ch',
          token: 'valid-token',
        },
      });

      await POST(req as any);

      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());
      expect(json.ok).toBe(true);
      expect(json.site_name).toBe('Example University Moodle');
    });

    it('should return 400 for missing parameters', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
      };

      (supabaseServer.createClient as jest.Mock).mockResolvedValue(
        mockSupabase
      );

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          action: 'test',
          // Missing moodle_url and token
        },
      });

      await POST(req as any);

      expect(res._getStatusCode()).toBe(400);
      const json = JSON.parse(res._getData());
      expect(json.error).toBe('Moodle-URL und Token erforderlich');
    });

    it('should return 401 for invalid token', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
      };

      (supabaseServer.createClient as jest.Mock).mockResolvedValue(
        mockSupabase
      );

      (moodleApi.testMoodleConnection as jest.Mock).mockResolvedValue({
        ok: false,
        error: 'Moodle error: Invalid access token',
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          action: 'test',
          moodle_url: 'https://moodle.example.ch',
          token: 'invalid-token',
        },
      });

      await POST(req as any);

      expect(res._getStatusCode()).toBe(401);
      const json = JSON.parse(res._getData());
      expect(json.error).toContain('Invalid access token');
    });
  });

  // ── POST action="connect" Tests ──────────────────────────────────────

  describe('POST action="connect"', () => {
    it('should connect and install plugin', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn()
              .mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: null, // Plugin not installed
                }),
              }),
          }),
          insert: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      (supabaseServer.createClient as jest.Mock).mockResolvedValue(
        mockSupabase
      );

      (moodleApi.testMoodleConnection as jest.Mock).mockResolvedValue({
        ok: true,
        siteInfo: {
          sitename: 'Example University',
          username: 'john.doe',
        },
      });

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          action: 'connect',
          moodle_url: 'https://moodle.example.ch',
          token: 'valid-token',
        },
      });

      await POST(req as any);

      expect(res._getStatusCode()).toBe(201);
      const json = JSON.parse(res._getData());
      expect(json.ok).toBe(true);
      expect(json.site_name).toBe('Example University');
    });
  });

  // ── POST action="sync" Tests ─────────────────────────────────────────

  describe('POST action="sync"', () => {
    it('should sync courses, assignments, and grades', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn()
              .mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: {
                    config: {
                      moodle_url: 'https://moodle.example.ch',
                      token: 'valid-token',
                    },
                  },
                }),
              }),
          }),
          update: jest.fn().mockResolvedValue({ error: null }),
        }),
      };

      const mockClient = {
        getCourses: jest.fn().mockResolvedValue([
          {
            id: 15,
            fullname: 'Mathematics 101',
            shortname: 'MATH101',
            summary: 'Intro to calculus',
            startdate: Math.floor(Date.now() / 1000),
          },
          {
            id: 23,
            fullname: 'Physics 201',
            shortname: 'PHYS201',
            summary: 'Advanced mechanics',
            startdate: Math.floor(Date.now() / 1000),
          },
        ]),
        getAssignments: jest
          .fn()
          .mockResolvedValue([
            {
              id: 1,
              name: 'Assignment 1',
              duedate: Math.floor(Date.now() / 1000) + 86400,
              grade: 100,
            },
          ]),
        getGrades: jest.fn().mockResolvedValue({
          items: [
            {
              id: 10,
              itemname: 'Quiz 1',
              grademax: 10,
              itemtype: 'quiz',
            },
          ],
          grades: [
            {
              itemid: 10,
              finalgrade: 8.5,
            },
          ],
        }),
      };

      (supabaseServer.createClient as jest.Mock).mockResolvedValue(
        mockSupabase
      );

      (moodleApi.createMoodleClient as jest.Mock).mockReturnValue(mockClient);

      const { req, res } = createMocks({
        method: 'POST',
        body: { action: 'sync' },
      });

      await POST(req as any);

      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());
      expect(json.ok).toBe(true);
      expect(json.courses).toBeGreaterThan(0);
    });

    it('should return 400 when Moodle not connected', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn()
              .mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  error: { message: 'Not found' },
                }),
              }),
          }),
        }),
      };

      (supabaseServer.createClient as jest.Mock).mockResolvedValue(
        mockSupabase
      );

      const { req, res } = createMocks({
        method: 'POST',
        body: { action: 'sync' },
      });

      await POST(req as any);

      expect(res._getStatusCode()).toBe(400);
      const json = JSON.parse(res._getData());
      expect(json.error).toBe('Moodle nicht verbunden');
    });
  });

  // ── POST action="disconnect" Tests ──────────────────────────────────

  describe('POST action="disconnect"', () => {
    it('should disconnect and disable plugin', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockResolvedValue({ error: null }),
          eq: jest.fn()
            .mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
        }),
      };

      (supabaseServer.createClient as jest.Mock).mockResolvedValue(
        mockSupabase
      );

      const { req, res } = createMocks({
        method: 'POST',
        body: { action: 'disconnect' },
      });

      await POST(req as any);

      expect(res._getStatusCode()).toBe(200);
      const json = JSON.parse(res._getData());
      expect(json.ok).toBe(true);
      expect(json.message).toContain('erfolgreich');
    });
  });

  // ── Invalid Action Tests ─────────────────────────────────────────────

  describe('POST with invalid action', () => {
    it('should return 400 for unknown action', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
      };

      (supabaseServer.createClient as jest.Mock).mockResolvedValue(
        mockSupabase
      );

      const { req, res } = createMocks({
        method: 'POST',
        body: { action: 'unknown' },
      });

      await POST(req as any);

      expect(res._getStatusCode()).toBe(400);
      const json = JSON.parse(res._getData());
      expect(json.error).toBe('Ungültige Aktion');
    });
  });
});

// ── Moodle-API Tests ─────────────────────────────────────────────────

describe('Moodle API Client', () => {
  describe('MoodleAPIClient.getSiteInfo', () => {
    it('should fetch site info', async () => {
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          sitename: 'Example University',
          username: 'john.doe',
          userid: 123,
        }),
      });

      const client = moodleApi.createMoodleClient(
        'https://moodle.example.ch',
        'token-123'
      );

      const info = await client.getSiteInfo();

      expect(info.sitename).toBe('Example University');
      expect(info.username).toBe('john.doe');
    });
  });

  describe('isValidMoodleUrl', () => {
    it('should validate HTTPS URLs', () => {
      expect(moodleApi.isValidMoodleUrl('https://moodle.example.ch')).toBe(
        true
      );
    });

    it('should validate HTTP URLs', () => {
      expect(moodleApi.isValidMoodleUrl('http://moodle.local')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(moodleApi.isValidMoodleUrl('not-a-url')).toBe(false);
      expect(moodleApi.isValidMoodleUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('Mapping functions', () => {
    it('should map Moodle course to Semetra format', () => {
      const moodleCourse = {
        id: 15,
        fullname: 'Mathematics 101',
        shortname: 'MATH101',
        summary: 'Intro to calculus',
        startdate: 1704067200,
        enddate: 1711929600,
        displayname: '',
        idnumber: '',
        summaryformat: 1,
        format: 'weeks',
        showgrades: 1,
        newsitems: 0,
        maxbytes: 0,
        numsections: 0,
        hiddensections: 0,
      };

      const mapped = moodleApi.mapMoodleCourseToSemetra(moodleCourse);

      expect(mapped.moodleId).toBe(15);
      expect(mapped.name).toBe('Mathematics 101');
      expect(mapped.code).toBe('MATH101');
      expect(mapped.startDate).not.toBeNull();
      expect(mapped.endDate).not.toBeNull();
    });
  });
});
