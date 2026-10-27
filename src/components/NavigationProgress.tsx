import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export const NavigationProgress = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setVisible(true);
    setProgress(20);
    const t1 = setTimeout(() => setProgress(70), 80);
    const t2 = setTimeout(() => setProgress(100), 300);
    const t3 = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [location.pathname]);

  if (!visible) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[101] h-0.5 bg-transparent pointer-events-none">
      <div
        className="h-full bg-primary transition-all duration-200 ease-out shadow-[0_0_8px_rgba(245,130,32,0.6)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};