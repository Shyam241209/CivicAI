import digitalGovernanceBg from "@/assets/digital-governance-bg.jpg";

interface GovernmentBackgroundProps {
  children: React.ReactNode;
  overlay?: "light" | "medium" | "dark";
  className?: string;
}

export const GovernmentBackground = ({ 
  children, 
  overlay = "medium",
  className = "" 
}: GovernmentBackgroundProps) => {
  const overlayClasses = {
    light: "bg-background/60",
    medium: "bg-background/80",
    dark: "bg-background/90"
  };

  return (
    <div className={`min-h-screen w-full flex-1 min-w-0 relative overflow-x-hidden ${className}`}>
      {/* Fixed 3D Government Background */}
      <div className="fixed inset-0 z-0">
        <img 
          src={digitalGovernanceBg} 
          alt="" 
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
        <div className={`absolute inset-0 ${overlayClasses[overlay]} backdrop-blur-[1px]`} />
      </div>
      
      {/* Content */}
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
};
