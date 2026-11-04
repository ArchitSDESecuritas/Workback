import { Router } from 'express'
import {
    verifyLoginOtp,
    verifyRegistrationOtp,
    requestPasswordReset,
    resetPassword,
    verifyPasswordResetOtp,
    updatePassword
} from '../Controller/Otp.js'

const otpRoutes = Router()

otpRoutes.post('/api/VerifyLoginOtp', verifyLoginOtp)
otpRoutes.post('/api/VerifyRegistrationOtp', verifyRegistrationOtp)
otpRoutes.post('/api/RequestPasswordReset', requestPasswordReset)
otpRoutes.post('/api/VerifyPasswordResetOtp', verifyPasswordResetOtp)
otpRoutes.post('/api/UpdatePassword', updatePassword)
otpRoutes.post('/api/ResetPassword', resetPassword)

export default otpRoutes