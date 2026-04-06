import { Project, IProject } from "../models/Project";
import mongoose from "mongoose";

export interface ProjectSearchResult {
  project: IProject;
  matchType: string;
  relevanceScore: number;
}

export interface ProjectSearchOptions {
  limit?: number;
  includeAll?: boolean;
  userId?: string;
  userRole?: "user" | "admin";
  userEmail?: string;
}

const PROJECT_KEYWORDS = [
  "worklet", "project", "mentor", "student", "domain", "college", "status", "stage",
  "professor", "prism", "internship", "research", "assignment", "collaboration",
  "id", "title", "ongoing", "completed", "review", "dropped", "excellent", "good", "average"
];

export const isProjectRelatedQuery = (query: string): boolean => {
  const lowercaseQuery = query.toLowerCase();
  return PROJECT_KEYWORDS.some(keyword => lowercaseQuery.includes(keyword));
};

const buildUserFilter = (options: ProjectSearchOptions): any => {
  if (options.userRole === "admin") {
    return {};
  }
  
  if (options.userEmail) {
    return {
      $or: [
        { userEmails: { $in: [options.userEmail.toLowerCase()] } },
        { userNames: { $regex: new RegExp(options.userEmail.split("@")[0], "i") } }
      ]
    };
  }
  
  return {};
};

export const searchProjects = async (
  query: string,
  options: ProjectSearchOptions = { limit: 20 }
): Promise<ProjectSearchResult[]> => {
  try {
    const userFilter = buildUserFilter(options);
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    const allResults: ProjectSearchResult[] = [];

    for (const term of searchTerms) {
      const regex = new RegExp(term, "i");
      const filter = {
        ...userFilter,
        $or: [
          { workletId: regex },
          { workletTitle: regex },
          { domain: regex },
          { status: regex },
          { college: regex },
          { mentors: { $regex: regex } },
          { students: { $regex: regex } },
          { professors: { $regex: regex } }
        ]
      };
      
      const projects = await Project.find(filter).limit(5).lean();
      allResults.push(...projects.map(project => ({
        project: project as IProject,
        matchType: "general",
        relevanceScore: 0.8
      })));
    }

    const uniqueResults = new Map<string, ProjectSearchResult>();
    allResults.forEach(result => {
      const key = (result.project._id as any).toString();
      if (!uniqueResults.has(key)) {
        uniqueResults.set(key, result);
      }
    });

    return Array.from(uniqueResults.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, options.limit || 20);
  } catch (error) {
    console.error("Error in project search:", error);
    return [];
  }
};

export const searchExactProject = async (
  workletId: string,
  options: ProjectSearchOptions = {}
): Promise<ProjectSearchResult | null> => {
  try {
    const userFilter = buildUserFilter(options);
    console.log(`🔍 Searching for exact worklet ID: ${workletId}`);
    
    // Try multiple variations of the worklet ID
    const variations = [
      workletId.toUpperCase(),           // Original as-is
      workletId.padStart(3, '0'),        // Pad to 3 digits: 1 -> 001
      parseInt(workletId).toString(),     // Remove leading zeros: 001 -> 1
    ];
    
    for (const variation of variations) {
      const filter = { workletId: variation, ...userFilter };
      console.log(`🔍 Trying worklet ID variation: ${variation}`);
      
      const project = await Project.findOne(filter).lean();
      if (project) {
        console.log(`✅ Found project with worklet ID: ${project.workletId}`);
        return {
          project: project as IProject,
          matchType: "exact_workletId",
          relevanceScore: 1.0
        };
      }
    }
    
    console.log(`❌ No project found for worklet ID: ${workletId}`);
    return null;
  } catch (error) {
    console.error("Error in exact project search:", error);
    return null;
  }
};

export const formatProjectResultsForRAG = (results: ProjectSearchResult[]): string => {
  if (results.length === 0) {
    return "";
  }

  return results.map(result => {
    const project = result.project;
    
    // Debug: Check for Unicode issues in workletId
    const workletIdClean = project.workletId.replace(/[^\x20-\x7E]/g, '');
    if (workletIdClean !== project.workletId) {
      console.warn(`⚠️  Non-ASCII characters found in worklet ID: "${project.workletId}" (hex: ${Buffer.from(project.workletId).toString('hex')})`);
    }
    
    let projectInfo = `WORKLET INFORMATION:\n`;
    projectInfo += `Worklet ID: ${project.workletId}\n`;
    projectInfo += `Title: ${project.workletTitle}\n`;
    projectInfo += `Domain: ${project.domain}\n`;
    projectInfo += `Institution: ${project.college}\n`;
    projectInfo += `Status (e.g. Good/Average/Poor): ${project.status}\n`;
    projectInfo += `Review Stage (e.g. Mid Review/Final Review): ${project.stage}\n`;
    
    if (project.mentors && project.mentors.length > 0) {
      projectInfo += `Mentors: ${project.mentors.join(", ")}\n`;
    }
    
    if (project.students && project.students.length > 0) {
      projectInfo += `Students: ${project.students.join(", ")}\n`;
    }
    
    if (project.professors && project.professors.length > 0) {
      projectInfo += `Professors: ${project.professors.join(", ")}\n`;
    }
    
    return projectInfo;
  }).join("\n\n---\n\n");
};

// ============================================================
// Aggregation helpers for analytical queries
// ============================================================

/**
 * Count projects matching a filter on a specific field
 */
export const countProjectsByField = async (
  field: string,
  value: string,
  userFilter: any = {}
): Promise<{ count: number; total: number }> => {
  const filter = { ...userFilter, [field]: { $regex: new RegExp(value, 'i') } };
  const [count, total] = await Promise.all([
    Project.countDocuments(filter),
    Project.countDocuments(userFilter)
  ]);
  return { count, total };
};

/**
 * Get distribution (group-by count) of a field
 */
export const getFieldDistribution = async (
  field: string,
  userFilter: any = {}
): Promise<Array<{ _id: string; count: number }>> => {
  const pipeline: any[] = [];
  if (Object.keys(userFilter).length > 0) {
    pipeline.push({ $match: userFilter });
  }
  pipeline.push(
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  );
  return Project.aggregate(pipeline);
};

/**
 * Get overall project/worklet statistics
 */
export const getProjectStats = async (userFilter: any = {}): Promise<{
  total: number;
  statusCounts: Record<string, number>;
  stageCounts: Record<string, number>;
  domainCount: number;
  collegeCount: number;
}> => {
  const matchStage = Object.keys(userFilter).length > 0 ? [{ $match: userFilter }] : [];

  const [total, statusDist, stageDist, domains, colleges] = await Promise.all([
    Project.countDocuments(userFilter),
    Project.aggregate([...matchStage, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Project.aggregate([...matchStage, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
    Project.distinct('domain', userFilter),
    Project.distinct('college', userFilter)
  ]);

  const statusCounts: Record<string, number> = {};
  statusDist.forEach(s => { statusCounts[s._id || 'Unknown'] = s.count; });

  const stageCounts: Record<string, number> = {};
  stageDist.forEach(s => { stageCounts[s._id || 'Unknown'] = s.count; });

  return { total, statusCounts, stageCounts, domainCount: domains.length, collegeCount: colleges.length };
};
