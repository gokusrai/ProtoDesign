import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, User, LogOut, Shield, ShoppingCart, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiService } from "@/services/api.service";
import { useCart } from "@/contexts/CartContext";
import { Badge } from "@/components/ui/badge";

interface UserInfo {
    id: string;
    email: string;
    name: string;
    role?: string;
}

export const Navigation = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [user, setUser] = useState<UserInfo | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const navigate = useNavigate();
    const { itemCount } = useCart();

    const checkAuthStatus = useCallback(async () => {
        try {
            if (!apiService.isAuthenticated()) {
                setUser(null);
                setIsAdmin(false);
                return;
            }

            // Verify session and get user info
            const userInfo = await apiService.getCurrentUser();

            let fullName =
                userInfo.user?.email?.split("@")[0];

            if (fullName) {
                fullName = fullName.charAt(0).toUpperCase() + fullName.slice(1);
            }

            setUser({
                id: userInfo.id || userInfo.user?.id || '',
                email: userInfo.user?.email || '',
                name: fullName,
                role: userInfo.role || userInfo.user?.role,
            });

            // Check if admin
            setIsAdmin(userInfo.role === 'admin' || userInfo.user?.role === 'admin');
        } catch (error) {
            console.error('Auth check failed:', error);
            apiService.clearToken(); // Clear invalid token
            setUser(null);
            setIsAdmin(false);
        }
    }, []);

    // Initial auth check on mount (once)
    useEffect(() => {
        checkAuthStatus().finally(() => {
            setAuthLoading(false);
        });
    }, [checkAuthStatus]);

    // Optional: Poll every 5 minutes (300000 ms) for token expiration
    useEffect(() => {
        const interval = setInterval(checkAuthStatus, 300); // 5 minutes
        return () => clearInterval(interval);
    }, [checkAuthStatus]);

    const handleSignOut = async () => {
        try {
            apiService.clearToken();
            setUser(null);
            setIsAdmin(false);
            navigate("/");
        } catch (error) {
            console.error('Sign out error:', error);
        }
        setIsOpen(false);
    };

    // Show loading state while checking auth
    if (authLoading) {
        return (
            <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border h-20 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary rounded-full animate-spin" />
            </nav>
        );
    }

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-20">
                    <Link to="/" className="flex items-center space-x-2">
                        <span className="font-display text-2xl font-bold text-foreground">
                            ProtoDesign
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-6">
                        <Link to="/" className="text-foreground hover:text-primary transition-all duration-200">
                            Home
                        </Link>
                        <Link to="/shop" className="text-foreground hover:text-primary transition-all duration-200">
                            Shop Printers
                        </Link>
                        <Link to="/custom" className="text-foreground hover:text-primary transition-all duration-200">
                            Custom Printing
                        </Link>

                        {user && (
                            <Link to="/orders" className="text-foreground hover:text-primary transition-all duration-200 flex items-center gap-1">
                                <Package className="w-4 h-4" />
                                Orders
                            </Link>
                        )}

                        {isAdmin && (
                            <Link to="/admin" className="text-foreground hover:text-primary transition-all duration-200 flex items-center gap-1">
                                <Shield className="w-4 h-4" />
                                Admin
                            </Link>
                        )}

                        <Link to="/cart" className="relative">
                            <Button variant="ghost" size="icon" asChild>
                                <ShoppingCart className="w-5 h-5" />
                            </Button>
                            {itemCount > 0 && (
                                <Badge className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs font-bold bg-destructive text-destructive-foreground border-2 border-background">
                                    {itemCount}
                                </Badge>
                            )}
                        </Link>

                        {user ? (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground max-w-32 truncate">
                                    Hi, {user.name}
                                </span>
                                <Button variant="outline" size="sm" onClick={handleSignOut}>
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Sign Out
                                </Button>
                            </div>
                        ) : (
                            <Link to="/auth">
                                <Button variant="default" size="sm">
                                    <User className="w-4 h-4 mr-2" />
                                    Sign In
                                </Button>
                            </Link>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors"
                        onClick={() => setIsOpen(!isOpen)}
                        aria-label="Toggle menu"
                    >
                        {isOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Mobile Navigation */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="md:hidden overflow-hidden border-t bg-background/95 backdrop-blur-md"
                        >
                            <div className="py-4 space-y-2 px-4">
                                <Link
                                    to="/"
                                    className="block py-3 px-3 rounded-lg text-foreground hover:text-primary hover:bg-accent transition-all duration-200"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Home
                                </Link>
                                <Link
                                    to="/shop"
                                    className="block py-3 px-3 rounded-lg text-foreground hover:text-primary hover:bg-accent transition-all duration-200"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Shop Printers
                                </Link>
                                <Link
                                    to="/custom"
                                    className="block py-3 px-3 rounded-lg text-foreground hover:text-primary hover:bg-accent transition-all duration-200"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Custom Printing
                                </Link>
                                <Link
                                    to="/cart"
                                    className="block py-3 px-3 rounded-lg text-foreground hover:text-primary hover:bg-accent transition-all duration-200 flex items-center gap-2"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <ShoppingCart className="w-4 h-4" />
                                    Cart {itemCount > 0 && `(${itemCount})`}
                                </Link>
                                {user && (
                                    <Link
                                        to="/orders"
                                        className="block py-3 px-3 rounded-lg text-foreground hover:text-primary hover:bg-accent transition-all duration-200 flex items-center gap-2"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <Package className="w-4 h-4" />
                                        My Orders
                                    </Link>
                                )}
                                {isAdmin && (
                                    <Link
                                        to="/admin"
                                        className="block py-3 px-3 rounded-lg text-foreground hover:text-primary hover:bg-accent transition-all duration-200 flex items-center gap-2"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <Shield className="w-4 h-4" />
                                        Admin Dashboard
                                    </Link>
                                )}
                                {user ? (
                                    <Button
                                        variant="outline"
                                        className="w-full mt-2"
                                        onClick={handleSignOut}
                                    >
                                        <LogOut className="w-4 h-4 mr-2" />
                                        Sign Out
                                    </Button>
                                ) : (
                                    <Link to="/auth" onClick={() => setIsOpen(false)}>
                                        <Button variant="default" className="w-full mt-2">
                                            <User className="w-4 h-4 mr-2" />
                                            Sign In
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </nav>
    );
};
