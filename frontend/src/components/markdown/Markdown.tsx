import { cn } from '@/lib/utils';
import { omit } from 'lodash';
import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { PluggableList } from 'unified';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
// import Image from 'next/image';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";


// import { ChainlitContext, type IMessageElement } from '@chainlit/react-client';

import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';


import CodeSnippet from './CodeSnippet';
import BlinkingCursor from "./BlinkingCursor";
// import { ElementRef } from './Elements/ElementRef';
import { MarkdownAlert, alertComponents } from './MarkdownAlert';
import Image from 'next/image';
import CustomTable from './CustomTable';
import { toast } from 'sonner';

interface Props {
  allowHtml?: boolean;
  latex?: boolean;
  //   refElements?: IMessageElement[];
  children: string;
  // currentData: string;
  className?: string;
}


const cursorPlugin = () => {
  return (tree: any) => {
    visit(tree, 'text', (node: any, index, parent) => {
      const placeholderPattern = /\u200B/g;
      const matches = [...(node.value?.matchAll(placeholderPattern) || [])];

      if (matches.length > 0) {
        const newNodes: any[] = [];
        let lastIndex = 0;

        matches.forEach((match) => {
          const [fullMatch] = match;
          const startIndex = match.index!;
          const endIndex = startIndex + fullMatch.length;

          if (startIndex > lastIndex) {
            newNodes.push({
              type: 'text',
              value: node.value!.slice(lastIndex, startIndex)
            });
          }

          newNodes.push({
            type: 'blinkingCursor',
            data: {
              hName: 'blinkingCursor',
              hProperties: { text: 'Blinking Cursor' }
            }
          });

          lastIndex = endIndex;
        });

        if (lastIndex < node.value!.length) {
          newNodes.push({
            type: 'text',
            value: node.value!.slice(lastIndex)
          });
        }

        parent!.children.splice(index, 1, ...newNodes);
      }
    });
  };
};

const Markdown = ({
  allowHtml,
  latex,
  //   refElements,
  className,
  // currentData,
  children
}: Props) => {
  //   const apiClient = useContext(ChainlitContext);


  const rehypePlugins = useMemo(() => {
    let rehypePlugins: PluggableList = [];
    if (allowHtml) {
      rehypePlugins = [rehypeRaw as any, ...rehypePlugins];
    }
    if (latex) {
      rehypePlugins = [[rehypeKatex as any, { strict: false }], ...rehypePlugins];
    }
    return rehypePlugins;
  }, [allowHtml, latex]);

  const remarkPlugins = useMemo(() => {
    let remarkPlugins: PluggableList = [
      cursorPlugin,
      remarkGfm as any,
      remarkDirective as any,
      MarkdownAlert
    ];

    if (latex) {
      remarkPlugins = [...remarkPlugins, remarkMath as any];
    }
    return remarkPlugins;
  }, [latex]);

  return (
    <div className={cn('prose lg:prose-xl', className)}>


      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          ...alertComponents, // add alert components
          code(props) {
            return (
              <code
                {...omit(props, ['node'])}
                className="relative rounded bg-gray-200 px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold"
              />
            );
          },
          pre({ children, ...props }: any) {
            return <CodeSnippet {...props} />;
          },
          a({ children, ...props }) {
            return (
              <a {...props} className="w-fit inline-block group" target="_blank" rel="noopener noreferrer" title={props.href}>
                <div className="bg-primary-light text-[#A7A7A7] hover:text-gray-500 rounded-[60px] text-[10px] px-2 py-0.5 opacity-90 hover:opacity-100 flex items-center w-fit transition-all duration-200">

                  <span className="text-xs font-medium">{children}</span>
                </div>
              </a>
            );
          },
          iframe: ({ src, title, width, height, ...props }: any) => {
            //   const handleDownload = () => {
            //     // Create anchor element to trigger download
            //     const a = document.createElement('a');
            //     a.href = src.startsWith('public') ? `${BASE_URL}/${src}` : src;
            //     a.download = title || "embedded-content";
            //     document.body.appendChild(a);
            //     a.click();
            //     document.body.removeChild(a);
            //   };

            return (
              <div className="my-4 w-full relative">
                <AspectRatio
                  ratio={16 / 9}
                  className="bg-muted rounded-md overflow-hidden"
                >
                  <iframe
                    src={
                      src.startsWith('public')
                        ? `${BASE_URL}/${src}`
                        : src
                    }
                    title={title || "Embedded content"}
                    width={width || "100%"}
                    height={height || "100%"}
                    allowFullScreen
                    className="h-full w-full border-none"
                    {...omit(props, ['node'])}
                  />
                </AspectRatio>
                {/* <button 
            onClick={handleDownload}
            className="absolute -top-2 -right-4 bg-slate-800 text-white p-1 rounded-md opacity-80 hover:opacity-100 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span className="ml-1 text-xs">Download</span>
          </button> */}
              </div>
            );
          },
          img: (image: any) => {
            const handleDownload = async () => {
              try {
                // Construct a valid absolute URL
                const imgSrc = image.src.startsWith('public')
                  ? new URL(image.src, BASE_URL).href
                  : image.src;

                const response = await fetch(imgSrc, { mode: 'cors' });

                if (!response.ok) {
                  throw new Error(`Failed to fetch image: ${response.statusText}`);
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = image.alt || 'image';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              } catch (error) {
                console.error('Error downloading image:', error);
                toast.error('Failed to download image. Please check the image URL.');
              }
            }

            return (
              <div className="flex items-center justify-center sm:max-w-sm md:max-w-md relative">
                <AspectRatio
                  ratio={16 / 9}
                  className="bg-muted rounded-md overflow-hidden"
                >
                  <img
                    src={
                      image.src.startsWith('public')
                        ? `${BASE_URL}/${image.src}`
                        : image.src
                    }
                    alt={image.alt}
                    className="h-full w-full object-contain"
                  />
                </AspectRatio>
                <button
                  onClick={handleDownload}
                  className="absolute top-2 right-2 bg-slate-800 text-white p-1 rounded-md opacity-80 hover:opacity-100 flex items-center"
                >
                  <Download className="text-white size-4" />
                  <span className="ml-2 text-xs">Download</span>
                </button>
              </div>
            );
          },
          blockquote(props) {
            return (
              <blockquote
                {...omit(props, ['node'])}
                className="mt-6 border-l-2 pl-6 italic"
              />
            );
          },
          em(props) {
            return <span {...omit(props, ['node'])} className="italic" />;
          },
          strong(props) {
            return <span {...omit(props, ['node'])} className="font-bold text-[#181818]" />;
          },
          hr() {
            return <Separator />;
          },
          ul(props): any {

            return (
              <ul
                {...omit(props, ['node'])}
                className="my-3 ml-3 list-disc pl-2"
              >

                <bdi className='text-sm text-[#7E7E7E] font-medium leading-normal [&>li]:mt-2'>{props.children}</bdi>

              </ul>
            );
          },

          ol(props) {
            return (
              <ol
                {...omit(props, ['node'])}
                className="my-3 ml-3 list-disc pl-2"
              >

                <bdi className='text-sm text-[#7E7E7E] font-medium leading-normal [&>li]:mt-2'>{props.children}</bdi>

              </ol>
            );
          },
          h1(props) {
            return (
              <h1
                {...omit(props, ['node'])}
                className="scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl mt-8 first:mt-0"
              />
            );
          },
          h2(props) {
            return (
              <h2
                {...omit(props, ['node'])}
                className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8 first:mt-0"
              />
            );
          },
          h3(props) {
            return (
              <h3
                {...omit(props, ['node'])}
                className="scroll-m-20 text-2xl font-semibold tracking-tight mt-6 first:mt-0"
              />
            );
          },
          h4(props) {
            return (
              <h4
                {...omit(props, ['node'])}
                className="scroll-m-20 text-xl font-semibold tracking-tight mt-6 first:mt-0"
              />
            );
          },
          p(props) {
            return (
              <div
                {...omit(props, ['node'])}
                className="sm:leading-[1.5rem] sm:text-sm text-[#7E7E7E] font-medium text-xs leading-[1.25rem] [&:not(:first-child)]:mt-4 whitespace-pre-wrap break-words"
                role="article"
              />
            );
          },
          table({ children }) {
            return <CustomTable children={children} />
          },
          thead({ children, ...props }) {
            return <TableHeader {...(props as any)} className='bg-[#F3F1EE]'>{children}</TableHeader>;
          },
          tr({ children, ...props }) {
            return <TableRow className='' {...(props as any)}>{children}</TableRow>;
          },
          th({ children, ...props }) {
            return <TableHead className='border-l border-r px-2.5 border-[#D2D2D2] first:border-l-0 last:border-r-0' {...(props as any)}>{children}</TableHead>;
          },
          td({ children, ...props }) {
            return <TableCell className='border-l border-r px-2.5 border-[#D2D2D2] first:border-l-0 last:border-r-0' {...(props as any)}>{children}</TableCell>;
          },
          tbody({ children, ...props }) {
            return <TableBody  {...(props as any)}>{children}</TableBody>;
          },
          // @ts-expect-error custom plugin
          blinkingCursor: () => <BlinkingCursor whitespace />
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

export default React.memo(Markdown);