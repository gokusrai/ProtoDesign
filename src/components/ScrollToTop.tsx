import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
    const { pathname } = useLocation();

    useLayoutEffect(() => {
        // 1. Immediate scroll (before paint)
        document.documentElement.scrollTo(0, 0);
        document.body.scrollTo(0, 0);

        // 2. Backup for some browsers/mobile that might lag
        const timeout = setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'auto' });
        }, 0);

        return () => clearTimeout(timeout);
    }, [pathname]);

    return null;
}