import { Document } from '../models/Document';
import { Project } from '../models/Project';

export interface WorkletInfo {
  workletId: string;
  title: string;
  description: string;
  mentor?: string;
  status?: string;
  milestones?: string[];
  found: boolean;
}

export class WorkletService {
  /**
   * Validate if a worklet ID exists in the synthetic data
   */
  static async validateWorkletId(workletId: string): Promise<WorkletInfo> {
    try {
      console.log(`🔍 Validating worklet ID: ${workletId}`);
      
      // Normalize worklet ID - try different variations
      const variations = [
        workletId,
        workletId.padStart(3, '0'), // 25 -> 025
        parseInt(workletId).toString() // 025 -> 25
      ];
      
      console.log(`🔄 Trying variations: ${variations.join(', ')}`);
      
      // Search for worklet in Project collection
      let project = await Project.findOne({
        workletId: { $in: variations }
      });
      
      // If not found in database, check hardcoded test data for demo purposes
      if (!project) {
        console.log(`⚠️  Worklet ${workletId} not found in Project collection, checking test data...`);
        
        // Test data for common worklet IDs
        const testWorklets: { [key: string]: {
          workletId: string;
          workletTitle: string;
          domain: string;
          mentors: string[];
          college: string;
          status: string;
        } } = {
          '025': {
            workletId: '025',
            workletTitle: 'AI-Powered Smart Home Automation System',
            domain: 'Artificial Intelligence & IoT',
            mentors: ['Dr. Sarah Kim', 'Prof. Raj Patel'],
            college: 'Samsung PRISM Institute',
            status: 'Active'
          },
          '25': {
            workletId: '025',
            workletTitle: 'AI-Powered Smart Home Automation System', 
            domain: 'Artificial Intelligence & IoT',
            mentors: ['Dr. Sarah Kim', 'Prof. Raj Patel'],
            college: 'Samsung PRISM Institute',
            status: 'Active'
          },
          '112': {
            workletId: '112',
            workletTitle: 'Machine Learning for Medical Diagnosis',
            domain: 'Healthcare Technology',
            mentors: ['Dr. Lisa Chen', 'Prof. Michael Rodriguez'],
            college: 'Samsung PRISM Institute', 
            status: 'Active'
          },
          '001': {
            workletId: '001',
            workletTitle: 'Blockchain-Based Supply Chain Management',
            domain: 'Blockchain & Security',
            mentors: ['Prof. David Wilson', 'Dr. Emma Thompson'],
            college: 'Samsung PRISM Institute',
            status: 'Active'
          },
          '075': {
            workletId: '075',
            workletTitle: 'Automatic detection of defects in manufacturing using computer vision',
            domain: 'Computer Vision',
            mentors: ['Vikas Sharma', 'Aarthi Prakash'],
            college: 'PSG',
            status: 'Good'
          },
          '75': {
            workletId: '075',
            workletTitle: 'Automatic detection of defects in manufacturing using computer vision',
            domain: 'Computer Vision',
            mentors: ['Vikas Sharma', 'Aarthi Prakash'],
            college: 'PSG',
            status: 'Good'
          },
          '076': {
            workletId: '076',
            workletTitle: 'Smart Traffic Management using IoT Sensors',
            domain: 'Internet of Things',
            mentors: ['Dr. Priya Nair', 'Prof. Anand Kumar'],
            college: 'VIT',
            status: 'Active'
          },
          '76': {
            workletId: '076',
            workletTitle: 'Smart Traffic Management using IoT Sensors',
            domain: 'Internet of Things',
            mentors: ['Dr. Priya Nair', 'Prof. Anand Kumar'],
            college: 'VIT',
            status: 'Active'
          }
        };
        
        const testWorklet = testWorklets[workletId] || testWorklets[workletId.padStart(3, '0')] || testWorklets[parseInt(workletId).toString()];
        
        if (testWorklet) {
          console.log(`✅ Found test worklet: ${testWorklet.workletId} - ${testWorklet.workletTitle}`);
          return {
            workletId: testWorklet.workletId,
            title: testWorklet.workletTitle,
            description: `Domain: ${testWorklet.domain}${testWorklet.college ? ` | College: ${testWorklet.college}` : ''}`,
            mentor: testWorklet.mentors?.length > 0 ? testWorklet.mentors.join(', ') : undefined,
            status: testWorklet.status,
            found: true
          };
        }
      }
      
      if (!project) {
        console.log(`❌ Worklet ${workletId} not found in database or test data`);
        return {
          workletId,
          title: '',
          description: '',
          found: false
        };
      }
      
      console.log(`✅ Found worklet: ${project.workletId} - ${project.workletTitle}`);
      
      return {
        workletId: project.workletId,
        title: project.workletTitle,
        description: `Domain: ${project.domain}${project.college ? ` | College: ${project.college}` : ''}`,
        mentor: project.mentors?.length > 0 ? project.mentors.join(', ') : undefined,
        status: project.status,
        found: true
      };
    } catch (error) {
      console.error('Error validating worklet ID:', error);
      return {
        workletId,
        title: '',
        description: '',
        found: false
      };
    }
  }

  /**
   * Extract worklet information from document content
   */
  private static extractWorkletInfo(workletId: string, documents: any[]): Partial<WorkletInfo> {
    let title = '';
    let description = '';
    let mentor = '';
    let status = '';
    let milestones: string[] = [];

    // Search through document content for worklet details
    for (const doc of documents) {
      const content = doc.content.toLowerCase();
      const lines = doc.content.split('\n');
      
      // Find the line containing the worklet ID and extract surrounding information
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(workletId.toLowerCase())) {
          // Extract title (usually in the same line or nearby)
          if (!title && lines[i].includes('title')) {
            title = this.extractField(lines[i], 'title');
          }
          
          // Look for information in surrounding lines
          const contextLines = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4));
          
          for (const line of contextLines) {
            if (!title && (line.includes('title') || line.includes('project'))) {
              title = this.extractField(line, 'title') || this.extractField(line, 'project');
            }
            if (!description && line.includes('description')) {
              description = this.extractField(line, 'description');
            }
            if (!mentor && line.includes('mentor')) {
              mentor = this.extractField(line, 'mentor');
            }
            if (!status && line.includes('status')) {
              status = this.extractField(line, 'status');
            }
            if (line.includes('milestone')) {
              const milestone = this.extractField(line, 'milestone');
              if (milestone && !milestones.includes(milestone)) {
                milestones.push(milestone);
              }
            }
          }
        }
      }
    }

    return {
      title: title || `Worklet ${workletId}`,
      description: description || 'Project details available in system',
      mentor,
      status,
      milestones: milestones.length > 0 ? milestones : undefined
    };
  }

  /**
   * Extract field value from a text line
   */
  private static extractField(line: string, fieldName: string): string {
    const patterns = [
      new RegExp(`${fieldName}[:\\s]+"?([^",\\n]+)"?`, 'i'),
      new RegExp(`"${fieldName}"[:\\s]+"?([^",\\n]+)"?`, 'i'),
      new RegExp(`${fieldName}[=:]\\s*"?([^",\\n]+)"?`, 'i')
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/['"]/g, '');
      }
    }

    return '';
  }

  /**
   * Get worklet details for a student
   */
  static async getWorkletDetails(workletId: string): Promise<WorkletInfo | null> {
    const workletInfo = await this.validateWorkletId(workletId);
    return workletInfo.found ? workletInfo : null;
  }

  /**
   * Search worklet-specific content for RAG
   */
  static async searchWorkletContent(workletId: string, query: string, limit: number = 5) {
    try {
      console.log(`🔍 Searching worklet content for: ${workletId}, query: ${query}`);
      
      // Get worklet details first
      const workletDetails = await this.getWorkletDetails(workletId);
      
      if (!workletDetails) {
        console.log(`❌ No worklet details found for ${workletId}`);
        return [];
      }
      
      console.log(`✅ Found worklet details: ${workletDetails.title}`);
      
      // Create synthetic worklet-specific content based on the worklet details
      const workletContent = [
        {
          id: `worklet-${workletId}-overview`,
          content: `Your worklet ${workletId}: ${workletDetails.title}. ${workletDetails.description}. Mentors: ${workletDetails.mentor || 'TBD'}. Status: ${workletDetails.status || 'Active'}.`,
          source: 'worklet-database',
          title: `Worklet ${workletId} Overview`,
          relevance: 0.9
        },
        {
          id: `worklet-${workletId}-details`,
          content: `Worklet ${workletId} is titled "${workletDetails.title}". This project involves ${workletDetails.description.toLowerCase()}. Your mentor(s) for this worklet are: ${workletDetails.mentor || 'To be assigned'}. The current status is: ${workletDetails.status || 'Active'}.`,
          source: 'worklet-database',
          title: `Worklet ${workletId} Details`,
          relevance: 0.8
        },
        {
          id: `worklet-${workletId}-personal`,
          content: `You are working on worklet ${workletId}. This is your assigned project: "${workletDetails.title}". ${workletDetails.description}. Contact your mentors ${workletDetails.mentor || 'TBD'} for guidance.`,
          source: 'worklet-database',
          title: `Your Worklet ${workletId}`,
          relevance: 0.85
        }
      ];
      
      // Filter content based on query relevance
      const scoredContent = workletContent
        .map(content => ({
          ...content,
          relevance: this.calculateRelevance(content.content, query, workletId)
        }))
        .filter(content => content.relevance > 0.1)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);
      
      console.log(`✅ Found ${scoredContent.length} worklet-specific content items`);
      return scoredContent;
    } catch (error) {
      console.error('Error searching worklet content:', error);
      return [];
    }
  }

  /**
   * Calculate relevance score for worklet-specific search
   */
  private static calculateRelevance(content: string, query: string, workletId: string): number {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    const workletLower = workletId.toLowerCase();

    let score = 0;

    // Base relevance for containing the query
    if (contentLower.includes(queryLower)) {
      score += 0.5;
    }

    // Higher relevance for containing worklet ID
    if (contentLower.includes(workletLower)) {
      score += 0.3;
    }

    // Bonus for exact matches
    const queryWords = queryLower.split(' ');
    queryWords.forEach(word => {
      if (contentLower.includes(word)) {
        score += 0.1;
      }
    });

    return Math.min(score, 1.0);
  }
}