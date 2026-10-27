import { useSignedImageUrl } from "@/lib/storageUrl";
import { cn } from "@/lib/utils";

interface StorageImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  path: string | null | undefined;
}

/** Renders an image stored in private report storage using a short-lived signed URL. */
export function StorageImage({ path, className, alt = "", ...props }: StorageImageProps) {
  const src = useSignedImageUrl(path);

  if (!src) {
    return <div className={cn("bg-muted animate-pulse", className)} aria-hidden />;
  }

  return <img src={src} alt={alt} className={className} {...props} />;
}
