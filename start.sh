#!/bin/bash

cd /Volumes/Workspace/jobcan
yarn
yarn dev > list.txt
open list.txt
