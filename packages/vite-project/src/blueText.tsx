import { css } from '@kuma-ui/core';

const text = css`
  color: blue;
`;

export function BlueText({ children }: { children: string }): JSX.Element {
  return <p className={text}>{children}</p>;
}
