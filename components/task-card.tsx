"use client";

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Heart, 
  Share2, 
  MoreHorizontal, 
  Check, 
  Bookmark, 
  Trash2,
  Clock,
  User
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Task } from '@/lib/indexeddb';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onToggleRead: (task: Task) => void;
  onToggleStock: (task: Task) => void;
  onDelete: (task: Task) => void;
  onShare: (task: Task) => void;
}

export function TaskCard({ task, onToggleRead, onToggleStock, onDelete, onShare }: TaskCardProps) {
  const [imageError, setImageError] = useState(false);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1日';
    if (diffDays < 7) return `${diffDays}日`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)}週間`;
    return `${Math.ceil(diffDays / 30)}ヶ月`;
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200 hover:shadow-lg border-border/50",
      "bg-card/50 backdrop-blur-sm",
      task.read && "opacity-60"
    )}>
      {task.imageUrl && !imageError && (
        <div className="aspect-video w-full overflow-hidden">
          <img
            src={task.imageUrl}
            alt={task.title}
            className="w-full h-full object-cover transition-transform duration-200 hover:scale-105"
            onError={() => setImageError(true)}
          />
        </div>
      )}
      
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className={cn(
            "font-semibold text-foreground leading-snug line-clamp-2 flex-1",
            task.completed && "line-through text-muted-foreground"
          )}>
            {task.title}
          </h3>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onToggleRead(task)}>
                <Check className="mr-2 h-4 w-4" />
                {task.read ? '未読にする' : '既読にする'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleStock(task)}>
                <Bookmark className="mr-2 h-4 w-4" />
                {task.stocked ? 'ストック解除' : 'ストックする'}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(task)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{task.author || task.source}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDate(task.createdAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge 
              variant={task.source === 'notion' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {task.source === 'notion' ? 'Notion' : 'GTasks'}
            </Badge>
            
            {task.stocked && (
              <Badge variant="outline" className="text-xs">
                <Bookmark className="h-3 w-3 mr-1" />
                Stock
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleRead(task)}
              className={cn(
                "flex items-center gap-2 text-muted-foreground hover:text-foreground",
                task.read && "text-primary"
              )}
            >
              <Heart className={cn("h-4 w-4", task.read && "fill-current")} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onShare(task)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleStock(task)}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              task.stocked && "text-primary"
            )}
          >
            <Bookmark className={cn("h-4 w-4", task.stocked && "fill-current")} />
          </Button>
        </div>
      </div>
    </Card>
  );
}