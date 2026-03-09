import bcrypt from "bcrypt";

const PEPPER = process.env.PEPPER;

export async function hashpassword(password){
    return await bcrypt.hash(password + PEPPER,12);
}

export async function verifypassword(password,hash){
    return await bcrypt.compare(password+PEPPER,hash)
}