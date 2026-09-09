import { AuthService } from "../services/authService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { env } from "../config/env.js";

export class AuthController {
  static async register(req, res, next) {
    try {
      const user = await AuthService.registerPatient(req.body);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Registration successful. Please log in.",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const { accessToken, refreshToken, user } = await AuthService.login(
        req.body,
      );

      // Set HttpOnly, Secure cookie for refresh token to prevent XSS theft
      const isProduction = env.nodeEnv === "production";
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "strict" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Days
        path: "/",
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Login successful",
        data: {
          accessToken, // Frontend stores this in memory not localStorage
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req, res, next) {
    try {
      const token = req.cookies?.refreshToken;
      if (!token) {
        const err = new Error("No active session.");
        err.statusCode = 401;
        throw err;
      }

      const { accessToken, user } = await AuthService.refresh(token);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: { accessToken, user },
      });
    } catch (error) {
      // A dead/expired/invalid refresh cookie should stop being sent on
      // every subsequent page load instead of erroring forever — clear it
      // the same way logout does.
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: env.nodeEnv === "production" ? "strict" : "lax",
        path: "/",
      });
      next(error);
    }
  }

  static async logout(req, res, next) {
    try {
      const token = req.cookies?.refreshToken;
      if (token) {
        await AuthService.logout(token);
      }
      
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: env.nodeEnv === "production" ? "strict" : "lax",
        path: "/",
      });
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  static async setupPassword(req, res, next) {
    try {
      const { token, hospitalSlug, newPassword } = req.body;
      const result = await AuthService.completeAccountSetup({
        token,
        hospitalSlug,
        newPassword,
      });
      res
        .status(HTTP_STATUS.OK)
        .json({
          success: true,
          message: "Password set successfully. You can now log in.",
          data: result,
        });
    } catch (error) {
      next(error);
    }
  }
}
