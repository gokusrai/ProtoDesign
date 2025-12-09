import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const Auth = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    // Check if already logged in
    useEffect(() => {
        if (apiService.isAuthenticated()) {
            navigate('/');
        }
    }, [navigate]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (isSignUp) {
                // Signup
                await apiService.signup(email, password, fullName);
                toast.success('Account created successfully!');
                navigate('/');
            } else {
                // Login
                await apiService.login(email, password);
                toast.success('Signed in successfully!');
                navigate('/');
            }
        } catch (error: any) {
            toast.error(error.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>{isSignUp ? 'Create Account' : 'Sign In'}</CardTitle>
                    <CardDescription>
                        {isSignUp
                            ? 'Create a new account to get started'
                            : 'Sign in to your ProtoDesign account'}
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleAuth} className="space-y-4">
                        {/* Full Name (only for signup) */}
                        {isSignUp && (
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input
                                    id="fullName"
                                    type="text"
                                    placeholder="John Doe"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    disabled={isLoading}
                                    required={isSignUp}
                                />
                            </div>
                        )}

                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                                required
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                required
                            />
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {isSignUp ? 'Creating account...' : 'Signing in...'}
                                </>
                            ) : (
                                isSignUp ? 'Create Account' : 'Sign In'
                            )}
                        </Button>

                        {/* Toggle Signup/Login */}
                        <div className="text-center text-sm">
                            {isSignUp ? (
                                <>
                                    Already have an account?{' '}
                                    <button
                                        type="button"
                                        onClick={() => setIsSignUp(false)}
                                        className="text-blue-600 hover:underline font-semibold"
                                    >
                                        Sign In
                                    </button>
                                </>
                            ) : (
                                <>
                                    Don't have an account?{' '}
                                    <button
                                        type="button"
                                        onClick={() => setIsSignUp(true)}
                                        className="text-blue-600 hover:underline font-semibold"
                                    >
                                        Sign Up
                                    </button>
                                </>
                            )}
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default Auth;
