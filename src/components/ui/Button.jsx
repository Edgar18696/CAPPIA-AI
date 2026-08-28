import {
  buttonBlue,
  buttonGreen,
  buttonRed,
  buttonGray,
  buttonYellow,
} from "../stylesAppia";

export default function Button({
  children,
  variant = "blue",
  style = {},
  ...props
}) {
  const estilos = {
    blue: buttonBlue,
    green: buttonGreen,
    red: buttonRed,
    gray: buttonGray,
    yellow: buttonYellow,
  };

  return (
    <button
      {...props}
      style={{
        ...(estilos[variant] ||
          buttonBlue),
        ...style,
      }}
    >
      {children}
    </button>
  );
}