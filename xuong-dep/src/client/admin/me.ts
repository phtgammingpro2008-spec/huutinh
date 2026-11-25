/** Who is signed in to the admin app: the owner sees everything, a manager (staff) not the owner's settings. */
let role: string | undefined;
export const setRole = (r: string | undefined) => { role = r; };
export const isOwner = () => role !== 'staff';
