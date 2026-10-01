import Link from "next/link";
export function Brand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="brand"><span className="mark" />The Closer</Link>;
}
