import bcrypt from "bcryptjs";

const OTP_LENGTH = 6;
const SALT_ROUNDS = 10;

export const generateOtp = (length = OTP_LENGTH) => {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < length; i += 1) {
    const randomIndex = Math.floor(Math.random() * digits.length);
    code += digits[randomIndex];
  }
  return code;
};

export const hashOtp = async (code: string) => bcrypt.hash(code, SALT_ROUNDS);
export const verifyOtp = async (code: string, hash: string) =>
  bcrypt.compare(code, hash);
