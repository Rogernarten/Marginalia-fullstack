import { Skeleton } from "@/components/ui/skeleton";

// Shown while the notebook pages check who's signed in.
export default function Loading() {
  return (
    <div className="mx-auto max-w-[62rem] px-5 py-8 lg:py-12">
      <Skeleton lines={8} className="max-w-[32rem]" />
    </div>
  );
}
