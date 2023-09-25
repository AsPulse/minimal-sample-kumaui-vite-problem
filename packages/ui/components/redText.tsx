import { css } from '@kuma-ui/core';

const text = css`
  color: red;
`;

export function RedText({ children }: { children: string }): JSX.Element {
  return <p className={text}>{children}</p>;
}
