export function isPublicPath(pathname: string): boolean {
	return pathname === '/login' || pathname === '/health' || pathname.startsWith('/login/');
}
