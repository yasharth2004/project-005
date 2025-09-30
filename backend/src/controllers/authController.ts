import { Request, Response } from 'express';
import { User, IUser } from '../models/User';
import { generateToken } from '../utils/jwt';
import { WorkletService } from '../services/workletService';

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password
    });

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during registration'
    });
  }
};

// @desc    Signup user with role and worklet validation
// @route   POST /api/auth/signup
// @access  Public
export const signup = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, workletId } = req.body;

    // Validate input
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email, password, and role'
      });
    }

    // Validate role
    if (!['user', 'admin', 'student'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be user, admin, or student'
      });
    }

    // Validate worklet ID for students
    if (role === 'student') {
      if (!workletId) {
        return res.status(400).json({
          success: false,
          error: 'Worklet ID is required for students'
        });
      }

      // Validate worklet ID exists in system
      const workletInfo = await WorkletService.validateWorkletId(workletId);
      if (!workletInfo.found) {
        return res.status(400).json({
          success: false,
          error: 'Invalid worklet ID. Please check with your mentor.'
        });
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Check if worklet ID is already taken by another student
    if (role === 'student' && workletId) {
      const existingWorkletUser = await User.findOne({ workletId });
      if (existingWorkletUser) {
        return res.status(400).json({
          success: false,
          error: 'This worklet ID is already assigned to another student'
        });
      }
    }

    // Create user
    const userData: any = {
      name,
      email,
      password,
      role
    };

    if (role === 'student' && workletId) {
      userData.workletId = workletId;
    }

    const user = await User.create(userData);

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          workletId: user.workletId
        },
        token
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during signup'
    });
  }
};

// @desc    Verify worklet ID
// @route   POST /api/auth/verify-worklet
// @access  Public
export const verifyWorklet = async (req: Request, res: Response) => {
  try {
    const { workletId } = req.body;

    if (!workletId) {
      return res.status(400).json({
        success: false,
        error: 'Worklet ID is required'
      });
    }

    // Validate worklet ID
    const workletInfo = await WorkletService.validateWorkletId(workletId);

    if (!workletInfo.found) {
      return res.status(200).json({
        valid: false,
        error: 'Worklet ID not found in system. Please check your worklet ID and try again.'
      });
    }

    // Check if worklet ID is already taken
    const existingUser = await User.findOne({ workletId: workletInfo.workletId });
    if (existingUser) {
      return res.status(200).json({
        valid: false,
        error: 'This worklet ID is already assigned to another student'
      });
    }

    res.json({
      valid: true,
      workletDetails: {
        id: workletInfo.workletId,
        title: workletInfo.title,
        description: workletInfo.description,
        mentor: workletInfo.mentor
      }
    });
  } catch (error) {
    console.error('Worklet verification error:', error);
    res.status(200).json({
      valid: false,
      error: 'Server error during worklet verification. Please try again.'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!._id);
    
    res.json({
      success: true,
      data: {
        user: {
          id: user!._id,
          name: user!.name,
          email: user!.email,
          role: user!.role,
          lastLogin: user!.lastLogin,
          createdAt: user!.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;
    const userId = req.user!._id;

    // Check if email is being changed and if it's already taken
    if (email && email !== req.user!.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email is already in use'
        });
      }
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      userId,
      { name, email },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user!._id,
          name: user!.name,
          email: user!.email,
          role: user!.role,
          lastLogin: user!.lastLogin,
          createdAt: user!.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during profile update'
    });
  }
};
