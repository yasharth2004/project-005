import ExcelJS from 'exceljs';
import fs from 'fs/promises';
import { Project, IProject } from '../models/Project';
import { IFile } from '../models/File';

export interface ProjectData {
  workletId: string;
  workletTitle: string;
  domain: string;
  mentors: string[];
  students: string[];
  college: string;
  status: string;
  stage: string;
  professors: string[];
}

export interface ProjectParsingResult {
  success: boolean;
  projects?: ProjectData[];
  error?: string;
  stats?: {
    totalRows: number;
    validProjects: number;
    skippedRows: number;
  };
}

// Extract email addresses from a text field
const extractEmails = (text: string): string[] => {
  if (!text) return [];
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailRegex) || [];
  return emails.map(email => email.toLowerCase().trim());
};

// Extract names from a text field (assuming comma or semicolon separated)
const extractNames = (text: string): string[] => {
  if (!text) return [];
  return text
    .split(/[,;|]/)
    .map(name => name.trim())
    .filter(name => name.length > 0 && name.length < 100);
};

// Parse project data from Excel file
export const parseProjectsFromExcel = async (filePath: string): Promise<ProjectParsingResult> => {
  try {
    console.log('📊 Starting project data parsing from Excel:', filePath);
    
    // Validate file exists and is readable
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error(`Excel file is empty: ${filePath}`);
    }
    
    console.log(`📊 File size: ${stats.size} bytes`);
    
    // Check if file is actually an Excel file
    const buffer = fs.readFileSync(filePath);
    const isValidExcel = buffer.toString('hex', 0, 2) === '504b' || // PK for .xlsx
                        buffer.toString('hex', 0, 8) === 'd0cf11e0a1b11ae1'; // OLE for .xls
    
    if (!isValidExcel) {
      throw new Error(`File does not appear to be a valid Excel file: ${filePath}`);
    }
    
    console.log('✅ File validation passed');
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('No worksheet found in Excel file');
    }
    
    console.log(`📄 Processing worksheet: ${worksheet.name}`);
    
    // Get header row to map columns
    const headerRow = worksheet.getRow(1);
    const headers: { [key: string]: number | number[] } = {};
    
    // Arrays to store multiple column numbers for mentors, students, professors
    const mentorColumns: number[] = [];
    const studentColumns: number[] = [];
    const professorColumns: number[] = [];
    
    headerRow.eachCell((cell, colNumber) => {
      const headerName = String(cell.value || '').toLowerCase().trim();
      
      if (headerName.includes('worklet') && headerName.includes('id')) {
        headers.workletId = colNumber;
      } else if (headerName.includes('worklet') && headerName.includes('title')) {
        headers.workletTitle = colNumber;
      } else if (headerName.includes('domain')) {
        headers.domain = colNumber;
      } else if (headerName.includes('mentor')) {
        mentorColumns.push(colNumber);
      } else if (headerName.includes('student')) {
        studentColumns.push(colNumber);
      } else if (headerName.includes('college')) {
        headers.college = colNumber;
      } else if (headerName.includes('status')) {
        headers.status = colNumber;
      } else if (headerName.includes('stage')) {
        headers.stage = colNumber;
      } else if (headerName.includes('professor')) {
        professorColumns.push(colNumber);
      }
    });
    
    // Store column arrays
    headers.mentors = mentorColumns;
    headers.students = studentColumns;
    headers.professors = professorColumns;
    
    console.log('📋 Detected single columns:', Object.keys(headers).filter(k => typeof headers[k] === 'number'));
    console.log('📋 Mentor columns:', mentorColumns);
    console.log('📋 Student columns:', studentColumns);
    console.log('📋 Professor columns:', professorColumns);
    
    const requiredColumns = ['workletId', 'workletTitle', 'domain', 'college', 'status', 'stage'];
    const missingColumns = requiredColumns.filter(col => !headers[col]);
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }
    
    const projects: ProjectData[] = [];
    let totalRows = 0;
    let skippedRows = 0;
    
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      totalRows++;
      
      try {
        const getCellValue = (colNum: number): string => {
          const cell = row.getCell(colNum);
          if (!cell.value) return '';
          return String(cell.value).trim();
        };
        
        const getMultipleValues = (columns: number[]): string[] => {
          return columns
            .map(col => getCellValue(col))
            .filter(val => val.length > 0);
        };
        
        const workletId = getCellValue(headers.workletId as number);
        const workletTitle = getCellValue(headers.workletTitle as number);
        const domain = getCellValue(headers.domain as number);
        const college = getCellValue(headers.college as number);
        const status = getCellValue(headers.status as number);
        const stage = getCellValue(headers.stage as number);
        
        if (!workletId || !workletTitle || !domain || !college || !status || !stage) {
          console.log(`⚠️  Skipping row ${rowNumber}: Missing required fields`);
          skippedRows++;
          return;
        }
        
        const mentors = getMultipleValues(mentorColumns);
        const students = getMultipleValues(studentColumns);
        const professors = getMultipleValues(professorColumns);
        
        console.log(`📝 Row ${rowNumber}: ${workletId} - ${workletTitle}`);
        console.log(`   Mentors: [${mentors.join(', ')}]`);
        console.log(`   Students: [${students.join(', ')}]`);
        console.log(`   Professors: [${professors.join(', ')}]`);
        
        projects.push({
          workletId,
          workletTitle,
          domain,
          mentors,
          students,
          college,
          status,
          stage,
          professors
        });
        
      } catch (error) {
        skippedRows++;
      }
    });
    
    return {
      success: true,
      projects,
      stats: { totalRows, validProjects: projects.length, skippedRows }
    };
    
  } catch (error) {
    console.error('❌ Error parsing projects from Excel:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Save projects to database with user associations
export const saveProjectsToDatabase = async (
  projects: ProjectData[],
  sourceFileId: string,
  uploadedBy: string
): Promise<void> => {
  try {
    console.log(`💾 Saving ${projects.length} projects to database`);
    
    await Project.deleteMany({ sourceFile: sourceFileId });
    
    const projectDocuments = projects.map(project => {
      const allEmails: string[] = [];
      const allNames: string[] = [];
      
      [...project.students, ...project.professors, ...project.mentors].forEach(person => {
        const emails = extractEmails(person);
        allEmails.push(...emails);
        
        if (emails.length === 0 && person.trim()) {
          allNames.push(person.trim());
        }
      });
      
      return {
        workletId: project.workletId,
        workletTitle: project.workletTitle,
        domain: project.domain,
        mentors: project.mentors,
        students: project.students,
        college: project.college,
        status: project.status,
        stage: project.stage,
        professors: project.professors,
        userEmails: [...new Set(allEmails)],
        userNames: [...new Set(allNames)],
        sourceFile: sourceFileId,
        uploadedBy
      };
    });
    
    await Project.insertMany(projectDocuments);
    console.log(`✅ Successfully saved ${projectDocuments.length} projects to database`);
    
  } catch (error) {
    console.error('❌ Error saving projects to database:', error);
    throw error;
  }
};

// Main function to process project file
export const processProjectFile = async (
  file: IFile,
  uploadedBy: string
): Promise<ProjectParsingResult> => {
  try {
    let result: ProjectParsingResult;
    
    if (file.fileType === 'xlsx' || file.fileType === 'xls') {
      result = await parseProjectsFromExcel(file.filePath);
    } else {
      throw new Error(`Unsupported file type for project data: ${file.fileType}`);
    }
    
    if (!result.success || !result.projects) {
      throw new Error(result.error || 'Failed to parse project data');
    }
    
    await saveProjectsToDatabase(
      result.projects,
      (file as any)._id.toString(),
      uploadedBy
    );
    
    return result;
    
  } catch (error) {
    console.error('❌ Error processing project file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};
