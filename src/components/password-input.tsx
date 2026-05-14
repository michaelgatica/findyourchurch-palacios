"use client";

import { useState, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput(props: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="password-input">
      <input {...props} type={isVisible ? "text" : "password"} />
      <button
        type="button"
        className="password-input__toggle"
        aria-label={isVisible ? "Hide password" : "Show password"}
        onClick={() => setIsVisible((currentValue) => !currentValue)}
      >
        {isVisible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
