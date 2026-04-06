/**
 * Moodle Web Services API Integration
 *
 * Handles REST API calls to Moodle LMS instances using personal web service tokens.
 * Maps between Moodle and Semetra data structures.
 */

import { logger } from "@/lib/logger";

const log = logger("lib:moodle-api");

// ── Types ────────────────────────────────────────────────────────────

export interface MoodleSiteInfo {
  sitename: string;
  username: string;
  firstname: string;
  lastname: string;
  fullname: string;
  lang: string;
  userid: number;
  usercreated: number;
  usermodified: number;
}

export interface MoodleCourse {
  id: number;
  shortname: string;
  fullname: string;
  displayname: string;
  idnumber: string;
  summary: string;
  summaryformat: number;
  format: string;
  showgrades: number;
  newsitems: number;
  startdate: number;
  enddate: number;
  maxbytes: number;
  numsections: number;
  hiddensections: number;
  courseformatoptions?: Array<{
    name: string;
    value: string;
  }>;
}

export interface MoodleAssignment {
  id: number;
  cmid: number;
  courseid: number;
  name: string;
  nosubmissions: number;
  submissiondrafts: number;
  sendnotifications: number;
  sendlatenotifications: number;
  sendstudentnotifications: number;
  duedate: number;
  allowsubmissionsfromdate: number;
  grade: number;
  timemodified: number;
  completionsubmit: number;
  cutoffdate: number;
  gradingduedate: number;
  teamsubmission: number;
  requireallteammemberssubmit: number;
  teamsubmissiongroupingid: number;
  blindmarking: number;
  hidegrader: number;
  revealidentities: number;
  attemptreopenmethod: string;
  maxattempts: number;
  markingworkflow: number;
  markingallocationworkflow: number;
  requiresubmissionstatement: number;
  preventsubmissionnotingroup: number;
  submissionstatement: string;
  submissionstatementformat: number;
  noreplyaddress: string;
  submissionfilearea: string;
  feedbackfilearea: string;
}

export interface MoodleGradeItem {
  id: number;
  courseid: number;
  itemtype: string;
  itemmodule: string;
  iteminstance: number;
  itemnumber: number;
  itemname: string;
  iteminfo: string;
  idnumber: string;
  calculation: string;
  gradetype: number;
  grademax: number;
  grademin: number;
  gradepass: number;
  locked: number;
  locktime: number;
  weightoverride: number;
  aggregationcoef: number;
  aggregationcoef2: number;
  sortorder: number;
  display: number;
  decimals: number;
  hidden: number;
  hiddenuntil: number;
  timecreated: number;
  timemodified: number;
  feedback: string;
  feedbackformat: number;
}

export interface MoodleGrade {
  id: number;
  itemid: number;
  userid: number;
  rawgrade: number | null;
  rawgrademax: number;
  rawgrademin: number;
  rawscaleid: string;
  usermodified: number;
  finalgrade: number | null;
  hidden: number;
  locked: number;
  locktime: number;
  exported: number;
  overridden: number;
  excluded: number;
  feedback: string;
  feedbackformat: number;
  information: string;
  informationformat: number;
  timecreated: number;
  timemodified: number;
}

export interface MoodleUser {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  fullname: string;
  email: string;
  department: string;
  institution: string;
  idnumber: string;
  interests: string;
  firstaccess: number;
  lastaccess: number;
  lastlogin: number;
  currentlogin: number;
  lastip: string;
}

export interface MoodleEnrollment {
  id: number;
  courseid: number;
  userid: number;
  status: number;
  roleassignments: Array<{
    roleid: number;
    name: string;
    shortname: string;
  }>;
}

export interface SemetraMappedCourse {
  moodleId: number;
  name: string;
  code: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
}

export interface SemetraMappedAssignment {
  moodleId: number;
  courseId: number;
  name: string;
  dueDate: string;
  gradeMax: number;
}

export interface SemetraMappedGrade {
  moodleItemId: number;
  courseId: number;
  name: string;
  grade: number | null;
  maxGrade: number;
  itemType: string;
}

// ── Moodle API Client ────────────────────────────────────────────────

class MoodleAPIClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    // Ensure base URL doesn't have trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  /**
   * Make a REST request to Moodle Web Services API
   */
  private async request<T>(
    wsfunction: string,
    params: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    const queryParams = new URLSearchParams({
      wstoken: this.token,
      wsfunction,
      moodlewsrestformat: "json",
    });

    // Add function parameters
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, String(value));
    });

    const url = `${this.baseUrl}/webservice/rest/server.php?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Moodle API request failed with status ${response.status}`
        );
      }

      const data = await response.json();

      // Check for Moodle error response
      if (data.exception || data.error) {
        const errorMsg = data.message || data.error || "Unknown Moodle error";
        log.error("Moodle API error", { wsfunction, errorMsg });
        throw new Error(`Moodle error: ${errorMsg}`);
      }

      return data as T;
    } catch (err) {
      log.error("Moodle API request error", {
        wsfunction,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Test the connection and get site info
   */
  async getSiteInfo(): Promise<MoodleSiteInfo> {
    return this.request<MoodleSiteInfo>("core_webservice_get_site_info");
  }

  /**
   * Get all courses enrolled by the user
   */
  async getCourses(): Promise<MoodleCourse[]> {
    const response = await this.request<{
      courses: MoodleCourse[];
      warnings?: Array<{ message: string }>;
    }>("core_enrol_get_users_courses", {
      userid: 0, // 0 = current user
    });

    return response.courses || [];
  }

  /**
   * Get assignments in a specific course
   */
  async getAssignments(courseId: number): Promise<MoodleAssignment[]> {
    const response = await this.request<{
      courses: Array<{
        id: number;
        assignments: MoodleAssignment[];
      }>;
      warnings?: Array<{ message: string }>;
    }>("mod_assign_get_assignments", {
      courseids: courseId,
    });

    if (!response.courses || response.courses.length === 0) {
      return [];
    }

    return response.courses[0].assignments || [];
  }

  /**
   * Get grades for the current user in a specific course
   */
  async getGrades(courseId: number): Promise<{
    items: MoodleGradeItem[];
    grades: MoodleGrade[];
  }> {
    const response = await this.request<{
      usergrades: Array<{
        courseid: number;
        gradesinfo?: {
          gradeitems: MoodleGradeItem[];
          grades: MoodleGrade[];
        };
      }>;
      warnings?: Array<{ message: string }>;
    }>("gradereport_user_get_grade_items", {
      courseid: courseId,
      userid: 0, // 0 = current user
    });

    if (!response.usergrades || response.usergrades.length === 0) {
      return { items: [], grades: [] };
    }

    const gradesInfo = response.usergrades[0].gradesinfo;
    if (!gradesInfo) {
      return { items: [], grades: [] };
    }

    return {
      items: gradesInfo.gradeitems || [],
      grades: gradesInfo.grades || [],
    };
  }

  /**
   * Get user information
   */
  async getUserInfo(): Promise<MoodleUser> {
    return this.request<MoodleUser>("core_user_get_users_by_id", {
      userids: 0, // 0 = current user
    });
  }
}

// ── Utility Functions ────────────────────────────────────────────────

/**
 * Create a Moodle API client
 */
export function createMoodleClient(baseUrl: string, token: string): MoodleAPIClient {
  return new MoodleAPIClient(baseUrl, token);
}

/**
 * Validate Moodle URL format
 */
export function isValidMoodleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Basic check: should be https or http
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Map Moodle course to Semetra module format
 */
export function mapMoodleCourseToSemetra(course: MoodleCourse): SemetraMappedCourse {
  return {
    moodleId: course.id,
    name: course.fullname,
    code: course.shortname || "",
    description: course.summary || "",
    startDate: course.startdate > 0 ? new Date(course.startdate * 1000).toISOString() : null,
    endDate: course.enddate > 0 ? new Date(course.enddate * 1000).toISOString() : null,
  };
}

/**
 * Map Moodle assignment to Semetra task format
 */
export function mapMoodleAssignmentToSemetra(
  assignment: MoodleAssignment,
  courseId: number
): SemetraMappedAssignment {
  return {
    moodleId: assignment.id,
    courseId,
    name: assignment.name,
    dueDate: assignment.duedate > 0
      ? new Date(assignment.duedate * 1000).toISOString()
      : new Date().toISOString(),
    gradeMax: assignment.grade || 100,
  };
}

/**
 * Map Moodle grade to Semetra grade format
 */
export function mapMoodleGradeToSemetra(
  item: MoodleGradeItem,
  grade: MoodleGrade,
  courseId: number
): SemetraMappedGrade {
  return {
    moodleItemId: item.id,
    courseId,
    name: item.itemname || "Unnamed Grade Item",
    grade: grade.finalgrade,
    maxGrade: item.grademax,
    itemType: item.itemtype,
  };
}

/**
 * Test connection to Moodle instance
 */
export async function testMoodleConnection(
  baseUrl: string,
  token: string
): Promise<{ ok: boolean; error?: string; siteInfo?: MoodleSiteInfo }> {
  try {
    if (!isValidMoodleUrl(baseUrl)) {
      return { ok: false, error: "Ungültige Moodle-URL-Format" };
    }

    const client = createMoodleClient(baseUrl, token);
    const siteInfo = await client.getSiteInfo();

    log.info("Moodle connection test successful", {
      sitename: siteInfo.sitename,
      username: siteInfo.username,
    });

    return { ok: true, siteInfo };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error("Moodle connection test failed", { error: errorMsg });
    return { ok: false, error: errorMsg };
  }
}

export { MoodleAPIClient };
