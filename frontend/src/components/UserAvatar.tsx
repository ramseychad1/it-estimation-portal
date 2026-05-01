import { forwardRef, type ButtonHTMLAttributes } from "react";

function initialsFor(firstName: string, lastName: string): string {
  const first = firstName?.[0] ?? "";
  const last = lastName?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

interface UserAvatarProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  firstName: string;
  lastName: string;
  size?: number;
  asButton?: boolean;
}

export const UserAvatar = forwardRef<HTMLButtonElement, UserAvatarProps>(
  function UserAvatar({ firstName, lastName, size = 32, asButton = true, className = "", ...rest }, ref) {
    const initials = initialsFor(firstName, lastName);
    const style = {
      width: size,
      height: size,
      borderRadius: "50%",
      background: "var(--color-near-black)",
      color: "var(--color-white)",
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.02em",
    } as const;

    if (asButton) {
      return (
        <button
          ref={ref}
          type="button"
          className={`inline-flex items-center justify-center border-0 cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-blue ${className}`}
          style={style}
          {...rest}
        >
          {initials}
        </button>
      );
    }

    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        style={style}
      >
        {initials}
      </span>
    );
  },
);
